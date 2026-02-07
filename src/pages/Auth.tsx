import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatPhone, formatCPF, isValidCPF } from "@/lib/format-utils";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { SignupStepIndicator } from "@/components/SignupStepIndicator";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255, "E-mail muito longo"),
  password: z.string().min(1, "Senha é obrigatória"),
});

// Step 1: Personal data
const step1Schema = z.object({
  fullName: z.string().trim().min(2, "Nome muito curto").max(100, "Nome muito longo"),
  email: z.string().trim().email("E-mail inválido").max(255, "E-mail muito longo"),
  phone: z.string().min(14, "Telefone inválido"),
  document: z.string().min(14, "CPF inválido").refine((val) => isValidCPF(val), "CPF inválido"),
});

// Step 3: Password
const step3Schema = z.object({
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
});

type LoginForm = z.infer<typeof loginSchema>;
type Step1Form = z.infer<typeof step1Schema>;
type Step3Form = z.infer<typeof step3Schema>;

const STEP_LABELS = ["Dados Pessoais", "Endereço", "Senha"];

const Auth = () => {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Multi-step state
  const [signupStep, setSignupStep] = useState(1);
  
  // Step 1 data
  const [step1Data, setStep1Data] = useState<Step1Form | null>(null);
  
  // Address fields (Step 2)
  const [address, setAddress] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressComplement, setAddressComplement] = useState("");

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });
  
  const step1Form = useForm<Step1Form>({
    resolver: zodResolver(step1Schema),
  });
  
  const step3Form = useForm<Step3Form>({
    resolver: zodResolver(step3Schema),
  });

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleLogin = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      await signIn(data.email, data.password);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep1Submit = (data: Step1Form) => {
    setStep1Data(data);
    setSignupStep(2);
  };

  const handleStep2Next = () => {
    setSignupStep(3);
  };

  const handleStep3Submit = async (data: Step3Form) => {
    if (!step1Data) return;
    
    setIsLoading(true);
    try {
      // Create user with Supabase Auth
      const { data: newUser, error: signUpError } = await supabase.auth.signUp({
        email: step1Data.email,
        password: data.password,
        options: {
          data: {
            full_name: step1Data.fullName,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          toast.error("Este e-mail já está cadastrado. Tente fazer login.");
        } else {
          toast.error(signUpError.message);
        }
        throw signUpError;
      }

      if (newUser?.user) {
        // Update profile with additional data including address
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            full_name: step1Data.fullName,
            phone: step1Data.phone,
            document: step1Data.document,
            address: address || null,
            address_number: addressNumber || null,
            address_complement: addressComplement || null,
          })
          .eq("user_id", newUser.user.id);

        if (profileError) {
          console.error("Error updating profile:", profileError);
        }

        // Send welcome email
        try {
          await supabase.functions.invoke('send-welcome-email', {
            body: {
              email: step1Data.email,
              name: step1Data.fullName,
            },
          });
        } catch (emailError) {
          console.error("Error sending welcome email:", emailError);
        }

        toast.success("Cadastro realizado! Você já pode fazer login.");
        resetSignupForm();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetSignupForm = () => {
    setSignupStep(1);
    setStep1Data(null);
    setAddress("");
    setAddressNumber("");
    setAddressComplement("");
    step1Form.reset();
    step3Form.reset();
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      
      if (error) throw error;
    } catch (error) {
      console.error("Erro ao fazer login com Google:", error);
      setIsLoading(false);
    }
  };

  const renderSignupStep = () => {
    switch (signupStep) {
      case 1:
        return (
          <form onSubmit={step1Form.handleSubmit(handleStep1Submit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-name">
                Nome completo
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input
                id="signup-name"
                placeholder="Seu nome"
                {...step1Form.register("fullName")}
              />
              {step1Form.formState.errors.fullName && (
                <p className="text-sm text-destructive mt-1">
                  {step1Form.formState.errors.fullName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email">
                E-mail
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="seu@email.com"
                {...step1Form.register("email")}
              />
              {step1Form.formState.errors.email && (
                <p className="text-sm text-destructive mt-1">
                  {step1Form.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-phone">
                Telefone
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input
                id="signup-phone"
                placeholder="(00) 00000-0000"
                {...step1Form.register("phone")}
                onChange={(e) => {
                  step1Form.setValue("phone", formatPhone(e.target.value));
                }}
              />
              {step1Form.formState.errors.phone && (
                <p className="text-sm text-destructive mt-1">
                  {step1Form.formState.errors.phone.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-document">
                CPF
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input
                id="signup-document"
                placeholder="000.000.000-00"
                {...step1Form.register("document")}
                onChange={(e) => {
                  step1Form.setValue("document", formatCPF(e.target.value));
                }}
              />
              {step1Form.formState.errors.document && (
                <p className="text-sm text-destructive mt-1">
                  {step1Form.formState.errors.document.message}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full">
              Continuar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Ou continue com</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continuar com Google
            </Button>
          </form>
        );
      
      case 2:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Informe seu endereço (opcional)
            </p>
            <AddressAutocomplete
              address={address}
              number={addressNumber}
              complement={addressComplement}
              onAddressChange={setAddress}
              onNumberChange={setAddressNumber}
              onComplementChange={setAddressComplement}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSignupStep(1)}
                className="flex-1"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <Button
                type="button"
                onClick={handleStep2Next}
                className="flex-1"
              >
                Continuar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      
      case 3:
        return (
          <form onSubmit={step3Form.handleSubmit(handleStep3Submit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-password">
                Senha
                <span className="text-destructive ml-1">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="signup-password"
                  type={showSignupPassword ? "text" : "password"}
                  placeholder="••••••••"
                  {...step3Form.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword(!showSignupPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showSignupPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Mínimo 8 caracteres, 1 maiúscula e 1 número
              </p>
              {step3Form.formState.errors.password && (
                <p className="text-sm text-destructive mt-1">
                  {step3Form.formState.errors.password.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-confirm">
                Confirmar senha
                <span className="text-destructive ml-1">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="signup-confirm"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  {...step3Form.register("confirmPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {step3Form.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {step3Form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSignupStep(2)}
                className="flex-1"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? "Cadastrando..." : "Cadastrar"}
              </Button>
            </div>
          </form>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pt-8">
          <div className="flex justify-center mb-6">
            <img src={logo} alt="Mister Ticket" className="h-16" />
          </div>
          <CardDescription className="text-base">Entre para comprar ingressos e acessar seus eventos</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full" onValueChange={() => resetSignupForm()}>
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

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Ou continue com</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continuar com Google
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
              <SignupStepIndicator
                currentStep={signupStep}
                totalSteps={3}
                labels={STEP_LABELS}
              />
              {renderSignupStep()}
            </TabsContent>
          </Tabs>

          <div className="mt-6 pt-4 border-t text-center">
            <p className="text-sm text-muted-foreground mb-2">Quer criar e gerenciar eventos?</p>
            <Link to="/produtor">
              <Button variant="outline" className="w-full">
                Acessar Área do Produtor
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
