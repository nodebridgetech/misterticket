import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// Structured logging utility
const authLog = {
  info: (action: string, data?: Record<string, any>) => {
    console.log(`[AUTH] ${action}`, {
      timestamp: new Date().toISOString(),
      ...data
    });
  },
  error: (action: string, error: any, data?: Record<string, any>) => {
    console.error(`[AUTH ERROR] ${action}`, {
      timestamp: new Date().toISOString(),
      error: error?.message || error,
      ...data
    });
  },
  warn: (action: string, data?: Record<string, any>) => {
    console.warn(`[AUTH WARNING] ${action}`, {
      timestamp: new Date().toISOString(),
      ...data
    });
  }
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  isProducerApproved: boolean;
  hasPendingProducerRequest: boolean;
  loading: boolean;
  roleLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestProducerRole: () => Promise<void>;
}

interface CachedRole {
  userRole: string | null;
  isProducerApproved: boolean;
  hasPendingProducerRequest: boolean;
  timestamp: number;
}

const CACHE_VERSION = 1; // Incrementar para invalidar todos os caches
const ROLE_CACHE_KEY = `user_role_cache_v${CACHE_VERSION}`;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cleanup old cache versions
const cleanupOldCaches = () => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('user_role_cache_v') && !key.includes(`_v${CACHE_VERSION}_`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      authLog.info("Old cache version removed", { key });
    });
    if (keysToRemove.length > 0) {
      authLog.info("Cache cleanup completed", { removedCount: keysToRemove.length });
    }
  } catch (error) {
    authLog.error("Cleanup old caches failed", error);
  }
};

// Check if URL has clear_cache parameter
const shouldClearCache = (): boolean => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('clear_cache') === 'true';
  } catch (error) {
    authLog.error("Error checking clear_cache parameter", error);
    return false;
  }
};

// Clear all role caches from localStorage
const clearAllRoleCaches = () => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('user_role_cache')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    authLog.info("All role caches cleared via URL parameter", { count: keysToRemove.length });
  } catch (error) {
    authLog.error("Clear all caches failed", error);
  }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isProducerApproved, setIsProducerApproved] = useState(false);
  const [hasPendingProducerRequest, setHasPendingProducerRequest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const navigate = useNavigate();

  const loadCachedRole = (userId: string): boolean => {
    try {
      const cached = localStorage.getItem(`${ROLE_CACHE_KEY}_${userId}`);
      if (!cached) {
        authLog.info("Cache miss", { userId });
        return false;
      }

      const cachedData: CachedRole = JSON.parse(cached);
      const isExpired = Date.now() - cachedData.timestamp > CACHE_DURATION;
      const cacheAge = Math.round((Date.now() - cachedData.timestamp) / 1000);
      
      authLog.info("Cache loaded", { 
        userId, 
        role: cachedData.userRole,
        isApproved: cachedData.isProducerApproved,
        hasPending: cachedData.hasPendingProducerRequest,
        isExpired,
        ageSeconds: cacheAge
      });
      
      if (!isExpired) {
        setUserRole(cachedData.userRole);
        setIsProducerApproved(cachedData.isProducerApproved);
        setHasPendingProducerRequest(cachedData.hasPendingProducerRequest);
        authLog.info("Cache applied", { userId, role: cachedData.userRole });
        return true;
      } else {
        authLog.warn("Cache expired", { userId, ageSeconds: cacheAge });
      }
    } catch (error) {
      authLog.error("Cache load failed", error, { userId });
    }
    return false;
  };

  const saveCachedRole = (userId: string, role: string | null, approved: boolean, pending: boolean) => {
    try {
      const cacheData: CachedRole = {
        userRole: role,
        isProducerApproved: approved,
        hasPendingProducerRequest: pending,
        timestamp: Date.now(),
      };
      localStorage.setItem(`${ROLE_CACHE_KEY}_${userId}`, JSON.stringify(cacheData));
      authLog.info("Cache saved", { userId, role, approved, pending });
    } catch (error) {
      authLog.error("Cache save failed", error, { userId });
    }
  };

  const clearCachedRole = (userId: string) => {
    try {
      localStorage.removeItem(`${ROLE_CACHE_KEY}_${userId}`);
      authLog.info("Cache cleared", { userId });
    } catch (error) {
      authLog.error("Cache clear failed", error, { userId });
    }
  };

  const fetchUserRole = async (userId: string, useCache: boolean = true) => {
    authLog.info("Fetching user role", { userId, useCache });
    setRoleLoading(true);
    
    // Load from cache first for instant UI (but keep loading state)
    if (useCache) {
      const hasCached = loadCachedRole(userId);
      if (hasCached) {
        authLog.info("Using cached role temporarily", { userId });
      }
      // Keep roleLoading true until DB revalidation completes
    }

    try {
      const startTime = Date.now();
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, is_approved")
        .eq("user_id", userId)
        .order("requested_at", { ascending: false });

      const queryTime = Date.now() - startTime;

      if (error) {
        authLog.error("Role query failed", error, { userId, queryTime });
        throw error;
      }

      authLog.info("Role query completed", { userId, queryTime, rolesCount: data?.length || 0 });

      let role: string | null = null;
      let approved = false;
      let pending = false;

      if (data && data.length > 0) {
        // Check if user is admin
        const adminRole = data.find(r => r.role === "admin");
        if (adminRole) {
          role = "admin";
          approved = false;
          pending = false;
          authLog.info("Admin role detected", { userId });
        } else {
          // Check if user is approved producer
          const producerRole = data.find(r => r.role === "producer" && r.is_approved);
          if (producerRole) {
            role = "producer";
            approved = true;
            pending = false;
            authLog.info("Approved producer role detected", { userId });
          } else {
            // Check if user has pending producer request
            const pendingProducerRole = data.find(r => r.role === "producer" && !r.is_approved);
            if (pendingProducerRole) {
              role = "visitor";
              approved = false;
              pending = true;
              authLog.info("Pending producer request detected", { userId });
            } else {
              // Default to visitor
              role = "visitor";
              approved = false;
              pending = false;
              authLog.info("Default visitor role assigned", { userId });
            }
          }
        }
      } else {
        // No roles found - default to visitor
        role = "visitor";
        approved = false;
        pending = false;
        authLog.warn("No roles found, defaulting to visitor", { userId });
      }

      // Update state
      setUserRole(role);
      setIsProducerApproved(approved);
      setHasPendingProducerRequest(pending);
      
      authLog.info("Role state updated", { userId, role, approved, pending });
      
      // Save to cache
      saveCachedRole(userId, role, approved, pending);
    } catch (error) {
      authLog.error("Role fetch failed", error, { userId });
      setUserRole("visitor");
      setIsProducerApproved(false);
      setHasPendingProducerRequest(false);
    } finally {
      setRoleLoading(false);
      authLog.info("Role loading completed", { userId });
    }
  };

  useEffect(() => {
    authLog.info("Auth context initializing");
    
    // Cleanup old cache versions
    cleanupOldCaches();
    
    // Check for clear_cache query parameter
    if (shouldClearCache()) {
      authLog.info("Clear cache parameter detected, clearing all caches");
      clearAllRoleCaches();
      
      // Remove the parameter from URL without reloading
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('clear_cache');
        window.history.replaceState({}, '', url.toString());
        authLog.info("Clear cache parameter removed from URL");
      } catch (error) {
        authLog.error("Failed to remove clear_cache parameter from URL", error);
      }
    }
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      authLog.info("Auth state changed", { 
        event, 
        userId: session?.user?.id,
        email: session?.user?.email,
        provider: session?.user?.app_metadata?.provider
      });
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // If clear_cache was triggered, force fetch without cache
        const useCache = !shouldClearCache();
        await fetchUserRole(session.user.id, useCache);
      } else {
        authLog.info("No session, clearing state");
        setUserRole(null);
        setIsProducerApproved(false);
        setHasPendingProducerRequest(false);
        setRoleLoading(false);
      }
      
      // Ensure loading is false after handling auth change
      setLoading(false);
      authLog.info("Auth state change handled", { event });
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      authLog.info("Initial session check", { 
        hasSession: !!session, 
        userId: session?.user?.id,
        email: session?.user?.email
      });
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // If clear_cache was triggered, force fetch without cache
        const useCache = !shouldClearCache();
        await fetchUserRole(session.user.id, useCache);
      } else {
        setRoleLoading(false);
      }
      
      setLoading(false);
      authLog.info("Initial session loaded");
    });

    return () => {
      authLog.info("Auth context unmounting");
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    authLog.info("Sign in attempt", { email });
    
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      authLog.error("Sign in failed", error, { email });
      toast.error(error.message);
      throw error;
    }
    
    authLog.info("Sign in successful", { 
      userId: data.user?.id,
      email: data.user?.email 
    });
    
    toast.success("Login realizado com sucesso!");
    navigate("/");
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    authLog.info("Sign up attempt", { email, fullName });
    
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    if (error) {
      authLog.error("Sign up failed", error, { email });
      toast.error(error.message);
      throw error;
    }

    authLog.info("Sign up successful", { 
      userId: data.user?.id,
      email: data.user?.email 
    });

    toast.success("Cadastro realizado! Você já pode fazer login.");
  };

  const signOut = async () => {
    const userId = user?.id;
    authLog.info("Sign out attempt", { userId });
    
    if (user) {
      clearCachedRole(user.id);
    }
    
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole(null);
    setIsProducerApproved(false);
    setHasPendingProducerRequest(false);
    
    authLog.info("Sign out successful", { userId });
    toast.success("Logout realizado com sucesso!");
    navigate("/");
  };

  const requestProducerRole = async () => {
    if (!user) {
      authLog.warn("Producer role request without user");
      return;
    }

    authLog.info("Producer role request", { userId: user.id });

    try {
      const { error } = await supabase
        .from("user_roles")
        .insert({
          user_id: user.id,
          role: "producer",
        });

      if (error) throw error;

      setHasPendingProducerRequest(true);
      authLog.info("Producer role requested successfully", { userId: user.id });
      toast.success("Solicitação enviada! Aguarde a aprovação do administrador.");
    } catch (error: any) {
      if (error.code === "23505") {
        authLog.warn("Duplicate producer role request", { userId: user.id });
        toast.error("Você já solicitou acesso de produtor.");
      } else {
        authLog.error("Producer role request failed", error, { userId: user.id });
        toast.error("Erro ao solicitar acesso de produtor");
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userRole,
        isProducerApproved,
        hasPendingProducerRequest,
        loading,
        roleLoading,
        signIn,
        signUp,
        signOut,
        requestProducerRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
