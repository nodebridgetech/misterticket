import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Building2, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCPF, formatPhone, isValidCPF, formatCNPJ, isValidCNPJ } from "@/lib/format-utils";

const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255, "E-mail muito longo"),
  password: z.string().min(1, "Senha é obrigatória"),
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Nome muito curto").max(100, "Nome muito longo"),
  email: z.string().trim().email("E-mail inválido").max(255, "E-mail muito longo"),
  phone: z.string().min(14, "Telefone inválido"),
  document: z.string().min(14, "CPF inválido").refine((val) => isValidCPF(val), "CPF inválido"),
  cnpj: z.string().optional(),
  password: z
    .string()
    .min(8, "Senha deve ter no mínimo 8 caracteres")
    .max(100, "Senha muito longa")
    .regex(/[A-Z]/, "Senha deve conter ao menos uma letra maiúscula")
    .regex(/[0-9]/, "Senha deve conter ao menos um número"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
}).refine((data) => !data.cnpj || data.cnpj.length === 0 || isValidCNPJ(data.cnpj), {
  message: "CNPJ inválido",
  path: ["cnpj"],
});

type LoginForm = z.infer<typeof loginSchema>;
type SignUpForm = z.infer<typeof signUpSchema>;

const ProducerAuth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pendingProducerData, setPendingProducerData] = useState<any>(null);
  const [isEditingPendingData, setIsEditingPendingData] = useState(false);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });
  const signUpForm = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
  });

  // Check if user is already logged in and is an approved producer
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Check if approved producer
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role, is_approved")
          .eq("user_id", session.user.id)
          .eq("role", "producer")
          .single();

        if (roleData?.is_approved) {
          navigate("/painel");
        }
      }
    };
    checkSession();
  }, [navigate]);

  const handleLogin = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        toast.error(error.message);
        throw error;
      }

      if (authData.user) {
        // Check producer role status
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role, is_approved")
          .eq("user_id", authData.user.id)
          .eq("role", "producer")
          .single();

        if (!roleData) {
          // User exists but is not a producer
          await supabase.auth.signOut();
          toast.error("Esta conta não possui acesso de produtor. Use a opção 'Entrar' para visitantes.");
          return;
        }

        if (!roleData.is_approved) {
          // Pending producer - show their data
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", authData.user.id)
            .single();

          setPendingProducerData({
            ...profile,
            email: authData.user.email,
          });
          
          // Sign out but keep data visible
          await supabase.auth.signOut();
          toast.info("Seu cadastro está pendente de aprovação.");
          return;
        }

        // Approved producer - redirect to dashboard
        toast.success("Login realizado com sucesso!");
        navigate("/painel");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (data: SignUpForm) => {
    setIsLoading(true);
    try {
      // First, check if email already exists as producer
      const { data: existingAuth } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (existingAuth?.user) {
        // User already exists, check if producer
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role, is_approved")
          .eq("user_id", existingAuth.user.id)
          .eq("role", "producer")
          .single();

        await supabase.auth.signOut();

        if (roleData) {
          if (roleData.is_approved) {
            toast.info("Você já tem uma conta de produtor aprovada. Faça login.");
          } else {
            // Show pending data
            const { data: profile } = await supabase
              .from("profiles")
              .select("*")
              .eq("user_id", existingAuth.user.id)
              .single();

            setPendingProducerData({
              ...profile,
              email: existingAuth.user.email,
            });
            toast.info("Seu cadastro está pendente de aprovação.");
          }
          setIsLoading(false);
          return;
        }
      }

      // Create new user
      const { data: newUser, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
          },
          emailRedirectTo: `${window.location.origin}/produtor`,
        },
      });

      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          toast.error("Este e-mail já está cadastrado. Tente fazer login ou use outro e-mail.");
        } else {
          toast.error(signUpError.message);
        }
        throw signUpError;
      }

      if (newUser?.user) {
        // Update profile with additional data
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            full_name: data.fullName,
            phone: data.phone,
            document: data.document,
            cnpj: data.cnpj || null,
          })
          .eq("user_id", newUser.user.id);

        if (profileError) {
          console.error("Error updating profile:", profileError);
        }

        // Create producer role request (pending approval)
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: newUser.user.id,
            role: "producer",
            is_approved: false,
          });

        if (roleError) {
          console.error("Error creating producer role:", roleError);
        }

        // Send welcome email
        try {
          await supabase.functions.invoke('send-welcome-email', {
            body: {
              email: data.email,
              name: data.fullName,
            },
          });
        } catch (emailError) {
          console.error("Error sending welcome email:", emailError);
        }

        // Sign out and show pending message
        await supabase.auth.signOut();
        
        toast.success("Cadastro realizado! Aguarde a aprovação do administrador.");
        setPendingProducerData({
          full_name: data.fullName,
          email: data.email,
          phone: data.phone,
          document: data.document,
          cnpj: data.cnpj || null,
        });
        signUpForm.reset();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePendingData = async () => {
    if (!pendingProducerData?.email) return;
    
    setIsLoading(true);
    try {
      // Re-authenticate to get user id
      const password = prompt("Digite sua senha para confirmar a alteração:");
      if (!password) {
        setIsLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: pendingProducerData.email,
        password,
      });

      if (authError) {
        toast.error("Senha incorreta.");
        setIsLoading(false);
        return;
      }

      if (authData.user) {
        const { error } = await supabase
          .from("profiles")
          .update({
            full_name: pendingProducerData.full_name,
            phone: pendingProducerData.phone,
            document: pendingProducerData.document,
            cnpj: pendingProducerData.cnpj,
          })
          .eq("user_id", authData.user.id);

        await supabase.auth.signOut();

        if (error) {
          toast.error("Erro ao atualizar dados.");
        } else {
          toast.success("Dados atualizados com sucesso!");
          setIsEditingPendingData(false);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar dados.");
    } finally {
      setIsLoading(false);
    }
  };

  // Show pending producer view
  if (pendingProducerData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
              <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <CardTitle className="text-2xl font-bold">Cadastro Pendente</CardTitle>
            <CardDescription>
              Seu cadastro como produtor está aguardando aprovação do administrador.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                Você receberá um e-mail assim que seu cadastro for aprovado.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <h3 className="font-medium text-sm text-muted-foreground">Seus dados de cadastro:</h3>
              
              {isEditingPendingData ? (
                <div className="space-y-3">
                  <div>
                    <Label>Nome Completo</Label>
                    <Input
                      value={pendingProducerData.full_name || ""}
                      onChange={(e) => setPendingProducerData({ ...pendingProducerData, full_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input
                      value={pendingProducerData.phone || ""}
                      onChange={(e) => setPendingProducerData({ ...pendingProducerData, phone: formatPhone(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>CPF</Label>
                    <Input
                      value={pendingProducerData.document || ""}
                      onChange={(e) => setPendingProducerData({ ...pendingProducerData, document: formatCPF(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>CNPJ (opcional)</Label>
                    <Input
                      value={pendingProducerData.cnpj || ""}
                      onChange={(e) => setPendingProducerData({ ...pendingProducerData, cnpj: formatCNPJ(e.target.value) })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleUpdatePendingData} disabled={isLoading} className="flex-1">
                      {isLoading ? "Salvando..." : "Salvar Alterações"}
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditingPendingData(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Nome:</span>
                    <span className="font-medium">{pendingProducerData.full_name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">E-mail:</span>
                    <span className="font-medium">{pendingProducerData.email}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Telefone:</span>
                    <span className="font-medium">{pendingProducerData.phone || "-"}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">CPF:</span>
                    <span className="font-medium">{pendingProducerData.document || "-"}</span>
                  </div>
                  {pendingProducerData.cnpj && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">CNPJ:</span>
                      <span className="font-medium">{pendingProducerData.cnpj}</span>
                    </div>
                  )}
                  <Button 
                    variant="outline" 
                    className="w-full mt-4"
                    onClick={() => setIsEditingPendingData(true)}
                  >
                    Editar Dados
                  </Button>
                </div>
              )}
            </div>

            <div className="pt-4 border-t">
              <Button 
                variant="ghost" 
                className="w-full"
                onClick={() => {
                  setPendingProducerData(null);
                  loginForm.reset();
                }}
              >
                Voltar ao Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Área do Produtor</CardTitle>
          <CardDescription>Gerencie seus eventos e vendas de ingressos</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">E-mail</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    {...loginForm.register("email")}
                  />
                  {loginForm.formState.errors.email && (
                    <p className="text-sm text-destructive mt-1">
                      {loginForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showLoginPassword ? "text" : "password"}
                      placeholder="••••••••"
                      {...loginForm.register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-destructive mt-1">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Entrando..." : "Entrar"}
                </Button>
                <div className="text-center mt-2">
                  <Link
                    to="/esqueci-senha"
                    className="text-sm text-primary hover:underline"
                  >
                    Esqueci minha senha
                  </Link>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nome completo *</Label>
                  <Input
                    id="signup-name"
                    placeholder="Seu nome"
                    {...signUpForm.register("fullName")}
                  />
                  {signUpForm.formState.errors.fullName && (
                    <p className="text-sm text-destructive mt-1">
                      {signUpForm.formState.errors.fullName.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">E-mail *</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    {...signUpForm.register("email")}
                  />
                  {signUpForm.formState.errors.email && (
                    <p className="text-sm text-destructive mt-1">
                      {signUpForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-phone">Telefone *</Label>
                  <Input
                    id="signup-phone"
                    placeholder="(00) 00000-0000"
                    {...signUpForm.register("phone")}
                    onChange={(e) => {
                      signUpForm.setValue("phone", formatPhone(e.target.value));
                    }}
                  />
                  {signUpForm.formState.errors.phone && (
                    <p className="text-sm text-destructive mt-1">
                      {signUpForm.formState.errors.phone.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-document">CPF *</Label>
                  <Input
                    id="signup-document"
                    placeholder="000.000.000-00"
                    {...signUpForm.register("document")}
                    onChange={(e) => {
                      signUpForm.setValue("document", formatCPF(e.target.value));
                    }}
                  />
                  {signUpForm.formState.errors.document && (
                    <p className="text-sm text-destructive mt-1">
                      {signUpForm.formState.errors.document.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-cnpj">CNPJ (opcional)</Label>
                  <Input
                    id="signup-cnpj"
                    placeholder="00.000.000/0000-00"
                    {...signUpForm.register("cnpj")}
                    onChange={(e) => {
                      signUpForm.setValue("cnpj", formatCNPJ(e.target.value));
                    }}
                  />
                  {signUpForm.formState.errors.cnpj && (
                    <p className="text-sm text-destructive mt-1">
                      {signUpForm.formState.errors.cnpj.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha *</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showSignupPassword ? "text" : "password"}
                      placeholder="••••••••"
                      {...signUpForm.register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showSignupPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {signUpForm.formState.errors.password && (
                    <p className="text-sm text-destructive mt-1">
                      {signUpForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Confirmar senha *</Label>
                  <div className="relative">
                    <Input
                      id="signup-confirm"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      {...signUpForm.register("confirmPassword")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {signUpForm.formState.errors.confirmPassword && (
                    <p className="text-sm text-destructive">
                      {signUpForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Cadastrando..." : "Solicitar Cadastro"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Após o cadastro, sua conta será analisada pelo administrador.
                </p>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 pt-4 border-t text-center">
            <p className="text-sm text-muted-foreground mb-2">Quer comprar ingressos?</p>
            <Link to="/auth">
              <Button variant="outline" className="w-full">
                Acessar como Visitante
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProducerAuth;
