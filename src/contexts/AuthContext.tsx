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
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUserRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role, is_approved")
      .eq("user_id", userId)
      .order("requested_at", { ascending: false });

    if (data && data.length > 0) {
      const approvedRoles = data.filter(r => r.is_approved);
      const producerRole = data.find(r => r.role === "producer");
      
      if (approvedRoles.length > 0) {
        setUserRole(approvedRoles[0].role);
      }
      
      setIsProducerApproved(producerRole?.is_approved || false);
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
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole(null);
    setIsProducerApproved(false);
    toast.success("Logout realizado com sucesso!");
    navigate("/");
  };

  const requestProducerRole = async () => {
    if (!user) return;

    const { error } = await supabase.from("user_roles").insert({
      user_id: user.id,
      role: "producer",
      is_approved: false,
    });

    if (error) {
      toast.error("Erro ao solicitar role de produtor");
      throw error;
    }

    toast.success("Solicitação enviada! Aguarde aprovação do administrador.");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userRole,
        isProducerApproved,
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
