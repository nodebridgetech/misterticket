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
  const [saleId, setSaleId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);


  // Wait for auth to load
  useEffect(() => {
    const timer = setTimeout(() => {
      setAuthLoading(false);
    }, 2000); // Wait 2 seconds for session to load

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Only redirect to auth if we're done loading and still no user
    if (!authLoading && !user) {
      toast({
        title: "Sessão expirada",
        description: "Por favor, faça login novamente para ver seus ingressos.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    // Only verify payment if we have both user and sessionId
    if (!authLoading && user && sessionId) {
      verifyPayment();
    } else if (!authLoading && !sessionId) {
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
        setSaleId(data.saleId);
        setQrCode(data.qrCode);
        
        toast({
          title: "Pagamento confirmado!",
          description: "Seu ingresso foi enviado para o e-mail cadastrado.",
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
            Seu ingresso foi processado com sucesso e enviado para o e-mail cadastrado.
          </p>

          <div className="bg-muted p-6 rounded-lg mb-8">
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">ID da Compra</p>
                <p className="font-mono text-sm">{saleId}</p>
              </div>
              {qrCode && (
                <div>
                  <p className="text-sm text-muted-foreground">Código QR</p>
                  <p className="font-mono text-sm">{qrCode}</p>
                </div>
              )}
            </div>
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
