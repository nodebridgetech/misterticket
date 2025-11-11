import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sales, setSales] = useState<Array<{ saleId: string; qrCode: string }>>([]);
  const [authLoading, setAuthLoading] = useState(true);


  // Wait for auth to load with longer timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      setAuthLoading(false);
    }, 5000); // Wait 5 seconds for session to load

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // If user is already loaded, we can proceed immediately
    if (user && sessionId && !authLoading) {
      verifyPayment();
      return;
    }

    // Only redirect to auth if we're done loading and still no user
    if (!authLoading && !user) {
      console.log("No user found after auth loading, redirecting to login");
      toast({
        title: "Sessão expirada",
        description: "Por favor, faça login novamente para ver seus ingressos.",
        variant: "destructive",
      });
      // Store the session_id in localStorage to verify after login
      if (sessionId) {
        localStorage.setItem("pending_payment_session", sessionId);
      }
      navigate("/auth");
      return;
    }

    if (!authLoading && !sessionId) {
      setError("ID da sessão não encontrado");
      setVerifying(false);
    }
  }, [sessionId, user, authLoading]);

  const verifyPayment = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("verify-payment", {
        body: { sessionId },
      });

      if (error) {
        throw new Error(error.message || "Erro ao verificar pagamento");
      }

      if (data?.success) {
        setVerified(true);
        setSales(data.sales || []);
        
        toast({
          title: "Pagamento confirmado!",
          description: `${data.sales?.length || 1} ingresso(s) enviado(s) para o e-mail cadastrado.`,
        });
      } else {
        throw new Error("Pagamento não confirmado");
      }
    } catch (err: any) {
      console.error("Error verifying payment:", err);
      setError(err.message || "Erro ao verificar pagamento");
      
      toast({
        title: "Erro",
        description: err.message || "Erro ao verificar pagamento",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  if (authLoading || verifying) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <Card className="p-12">
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-6" />
            <h1 className="text-2xl font-bold mb-2">
              {authLoading ? "Carregando..." : "Verificando pagamento..."}
            </h1>
            <p className="text-muted-foreground">
              {authLoading 
                ? "Aguarde enquanto carregamos suas informações."
                : "Por favor, aguarde enquanto confirmamos seu pagamento."
              }
            </p>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <Card className="p-12">
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-6" />
            <h1 className="text-2xl font-bold mb-2">Erro ao processar pagamento</h1>
            <p className="text-muted-foreground mb-8">{error}</p>
            <div className="flex gap-4 justify-center">
              <Button onClick={() => navigate("/eventos")} variant="outline">
                Ver Eventos
              </Button>
              <Button onClick={verifyPayment}>
                Tentar Novamente
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto text-center">
        <Card className="p-12">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-4">Pagamento Confirmado!</h1>
          <p className="text-lg text-muted-foreground mb-8">
            {sales.length > 1 
              ? `Seus ${sales.length} ingressos foram processados com sucesso e enviados para o e-mail cadastrado.`
              : "Seu ingresso foi processado com sucesso e enviado para o e-mail cadastrado."
            }
          </p>

          <div className="space-y-4 mb-8">
            {sales.map((sale, index) => (
              <div key={sale.saleId} className="bg-muted p-6 rounded-lg">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {sales.length > 1 ? `Ingresso ${index + 1} de ${sales.length}` : "ID da Compra"}
                    </p>
                    <p className="font-mono text-sm">{sale.saleId}</p>
                  </div>
                  {sale.qrCode && (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-sm text-muted-foreground">Código QR</p>
                      <img 
                        src={sale.qrCode} 
                        alt={`QR Code - Ingresso ${index + 1}`}
                        className="w-48 h-48 border border-border rounded-lg"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 text-left mb-8">
            <p className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <span>Ingresso digital com QR Code enviado por e-mail</span>
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <span>Confirmação de pagamento processada</span>
            </p>
            <p className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <span>Apresente o QR Code na entrada do evento</span>
            </p>
          </div>

          <div className="flex gap-4 justify-center">
            <Button onClick={() => navigate("/minha-conta")} variant="outline">
              Meus Ingressos
            </Button>
            <Button onClick={() => navigate("/eventos")} variant="hero">
              Ver Mais Eventos
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PaymentSuccess;
