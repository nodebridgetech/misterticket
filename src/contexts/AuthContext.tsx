import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { logActivity } from "@/hooks/useActivityLog";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  isProducerApproved: boolean;
  hasPendingProducerRequest: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestProducerRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isProducerApproved, setIsProducerApproved] = useState(false);
  const [hasPendingProducerRequest, setHasPendingProducerRequest] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUserRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role, is_approved")
      .eq("user_id", userId)
      .order("requested_at", { ascending: false });

    if (data && data.length > 0) {
      // Check if user is admin
      const adminRole = data.find(r => r.role === "admin");
      if (adminRole) {
        setUserRole("admin");
        setIsProducerApproved(false);
        setHasPendingProducerRequest(false);
        return;
      }

      // Check if user is approved producer
      const producerRole = data.find(r => r.role === "producer" && r.is_approved);
      if (producerRole) {
        setUserRole("producer");
        setIsProducerApproved(true);
        setHasPendingProducerRequest(false);
        return;
      }

      // Check if user has pending producer request
      const pendingProducerRole = data.find(r => r.role === "producer" && !r.is_approved);
      if (pendingProducerRole) {
        setUserRole("visitor");
        setIsProducerApproved(false);
        setHasPendingProducerRequest(true);
        return;
      }

      // Default to visitor
      setUserRole("visitor");
      setIsProducerApproved(false);
      setHasPendingProducerRequest(false);
    }
  };

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(() => {
          fetchUserRole(session.user.id);
        }, 0);
      } else {
        setUserRole(null);
        setIsProducerApproved(false);
        setHasPendingProducerRequest(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
      }
      setLoading(false);
    });
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      toast.error(error.message);
      throw error;
    }

    // Log login activity
    if (data.user) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("user_id", data.user.id)
          .single();
        
        const { error: logError } = await supabase.from("activity_logs").insert({
          user_id: data.user.id,
          user_name: profile?.full_name || email,
          user_phone: profile?.phone || null,
          action_type: "login",
          entity_type: "user",
          entity_id: data.user.id,
          entity_name: profile?.full_name || email,
          details: { method: "password" },
        });
        
        if (logError) {
          console.error("Error inserting login log:", logError);
        }
      } catch (logError) {
        console.error("Error logging login activity:", logError);
      }
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
    // Log logout activity before signing out
    if (user) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("user_id", user.id)
          .single();
        
        const { error: logError } = await supabase.from("activity_logs").insert({
          user_id: user.id,
          user_name: profile?.full_name || user.email,
          user_phone: profile?.phone || null,
          action_type: "logout",
          entity_type: "user",
          entity_id: user.id,
          entity_name: profile?.full_name || user.email,
          details: null,
        });
        
        if (logError) {
          console.error("Error inserting logout log:", logError);
        }
      } catch (logError) {
        console.error("Error logging logout activity:", logError);
      }
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
