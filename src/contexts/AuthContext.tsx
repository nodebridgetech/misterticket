import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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

const ROLE_CACHE_KEY = 'user_role_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
        console.log("AuthContext: No cache found for user", userId);
        return false;
      }

      const cachedData: CachedRole = JSON.parse(cached);
      const isExpired = Date.now() - cachedData.timestamp > CACHE_DURATION;
      
      console.log("AuthContext: Cache loaded", { 
        userId, 
        cachedData, 
        isExpired,
        age: Math.round((Date.now() - cachedData.timestamp) / 1000) + 's'
      });
      
      if (!isExpired) {
        setUserRole(cachedData.userRole);
        setIsProducerApproved(cachedData.isProducerApproved);
        setHasPendingProducerRequest(cachedData.hasPendingProducerRequest);
        return true;
      } else {
        console.log("AuthContext: Cache expired, clearing");
      }
    } catch (error) {
      console.error("Error loading cached role:", error);
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
    } catch (error) {
      console.error("Error saving cached role:", error);
    }
  };

  const clearCachedRole = (userId: string) => {
    try {
      localStorage.removeItem(`${ROLE_CACHE_KEY}_${userId}`);
    } catch (error) {
      console.error("Error clearing cached role:", error);
    }
  };

  const fetchUserRole = async (userId: string, useCache: boolean = true) => {
    setRoleLoading(true);
    
    // Load from cache first for instant UI (but keep loading state)
    if (useCache) {
      loadCachedRole(userId);
      // Keep roleLoading true until DB revalidation completes
    }

    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role, is_approved")
        .eq("user_id", userId)
        .order("requested_at", { ascending: false });

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
        } else {
          // Check if user is approved producer
          const producerRole = data.find(r => r.role === "producer" && r.is_approved);
          if (producerRole) {
            role = "producer";
            approved = true;
            pending = false;
          } else {
            // Check if user has pending producer request
            const pendingProducerRole = data.find(r => r.role === "producer" && !r.is_approved);
            if (pendingProducerRole) {
              role = "visitor";
              approved = false;
              pending = true;
            } else {
              // Default to visitor
              role = "visitor";
              approved = false;
              pending = false;
            }
          }
        }
      } else {
        // No roles found - default to visitor
        role = "visitor";
        approved = false;
        pending = false;
      }

      // Update state
      setUserRole(role);
      setIsProducerApproved(approved);
      setHasPendingProducerRequest(pending);
      
      console.log("AuthContext: Role updated", { userId, role, approved, pending });
      
      // Save to cache
      saveCachedRole(userId, role, approved, pending);
    } catch (error) {
      console.error("Error fetching user role:", error);
      setUserRole("visitor");
      setIsProducerApproved(false);
      setHasPendingProducerRequest(false);
    } finally {
      setRoleLoading(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("AuthContext: Auth state changed", { event, userId: session?.user?.id });
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchUserRole(session.user.id);
      } else {
        setUserRole(null);
        setIsProducerApproved(false);
        setHasPendingProducerRequest(false);
        setRoleLoading(false);
      }
      
      // Ensure loading is false after handling auth change
      setLoading(false);
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log("AuthContext: Initial session loaded", { userId: session?.user?.id });
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserRole(session.user.id);
      } else {
        setRoleLoading(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      toast.error(error.message);
      throw error;
    }
    
    toast.success("Login realizado com sucesso!");
    navigate("/");
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
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
      toast.error(error.message);
      throw error;
    }

    toast.success("Cadastro realizado! Você já pode fazer login.");
  };

  const signOut = async () => {
    if (user) {
      clearCachedRole(user.id);
    }
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole(null);
    setIsProducerApproved(false);
    setHasPendingProducerRequest(false);
    toast.success("Logout realizado com sucesso!");
    navigate("/");
  };

  const requestProducerRole = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("user_roles")
        .insert({
          user_id: user.id,
          role: "producer",
        });

      if (error) throw error;

      setHasPendingProducerRequest(true);
      toast.success("Solicitação enviada! Aguarde a aprovação do administrador.");
    } catch (error: any) {
      if (error.code === "23505") {
        toast.error("Você já solicitou acesso de produtor.");
      } else {
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
