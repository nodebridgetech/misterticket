import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { loadStripe } from "@stripe/stripe-js";

const Checkout = () => {
  const { id: eventId } = useParams();
  const [searchParams] = useSearchParams();
  const ticketId = searchParams.get("ticket");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [event, setEvent] = useState<any>(null);
  const [ticket, setTicket] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!user) {
      toast({
        title: "Acesso negado",
        description: "Você precisa estar logado para fazer uma compra.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    if (eventId && ticketId) {
      fetchCheckoutDetails();
    }
  }, [eventId, ticketId, user]);

  const fetchCheckoutDetails = async () => {
    try {
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .maybeSingle();

      if (eventError || !eventData) {
        throw new Error("Evento não encontrado");
      }

      const { data: ticketData, error: ticketError } = await supabase
        .from("tickets")
        .select("*")
        .eq("id", ticketId)
        .maybeSingle();

      if (ticketError || !ticketData) {
        throw new Error("Ingresso não encontrado");
      }

      setEvent(eventData);
      setTicket(ticketData);
    } catch (error: any) {
      console.error("Error fetching checkout details:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar detalhes do checkout.",
        variant: "destructive",
      });
      navigate(`/event/${eventId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!user || !ticket || !event) return;

    setProcessing(true);
    try {
      // Get Stripe publishable key from environment
      const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
      if (!stripeKey) {
        throw new Error("Stripe não configurado");
      }

      const stripe = await loadStripe(stripeKey);
      if (!stripe) {
        throw new Error("Erro ao carregar Stripe");
      }

      // Create checkout session via Stripe API
      // This is a placeholder - you'll need to create a backend endpoint
      // to create the Stripe checkout session
      const totalAmount = Number(ticket.price) * quantity;
      
      toast({
        title: "Processando",
        description: "Redirecionando para o pagamento...",
      });

      // TODO: Call backend to create Stripe checkout session
      // For now, show a message
      toast({
        title: "Em desenvolvimento",
        description: "A integração com Stripe será finalizada em breve.",
      });

    } catch (error: any) {
      console.error("Checkout error:", error);
      toast({
        title: "Erro no checkout",
        description: error.message || "Erro ao processar pagamento.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!event || !ticket) {
    return null;
  }

  const totalAmount = Number(ticket.price) * quantity;
  const available = ticket.quantity_total - ticket.quantity_sold;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Finalizar Compra</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Event & Ticket Details */}
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Detalhes do Evento</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Evento</p>
                  <p className="font-semibold">{event.title}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data</p>
                  <p className="font-semibold">
                    {new Date(event.event_date).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Local</p>
                  <p className="font-semibold">{event.venue}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Ingresso</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  <p className="font-semibold">{ticket.batch_name}</p>
                  {ticket.sector && <p className="text-sm text-muted-foreground">{ticket.sector}</p>}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Preço unitário</p>
                  <p className="text-2xl font-bold text-primary">
                    R$ {Number(ticket.price).toFixed(2).replace('.', ',')}
                  </p>
                </div>
                <div>
                  <Label htmlFor="quantity">Quantidade</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    max={Math.min(available, 10)}
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="mt-1"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    {available} ingressos disponíveis
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Payment Summary */}
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Resumo do Pedido</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Ingressos ({quantity}x)</span>
                  <span>R$ {(Number(ticket.price) * quantity).toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxa de serviço</span>
                  <span>R$ 0,00</span>
                </div>
                <div className="border-t pt-3 flex justify-between text-xl font-bold">
                  <span>Total</span>
                  <span className="text-primary">
                    R$ {totalAmount.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Pagamento</h2>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Você será redirecionado para uma página segura do Stripe para finalizar o pagamento.
                </p>
                
                <Button
                  onClick={handleCheckout}
                  disabled={processing || quantity < 1 || quantity > available}
                  className="w-full"
                  variant="hero"
                  size="lg"
                >
                  {processing ? "Processando..." : "Ir para Pagamento"}
                </Button>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>✓ Pagamento 100% seguro via Stripe</p>
                  <p>✓ Ingressos enviados por e-mail imediatamente</p>
                  <p>✓ QR Code para entrada no evento</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
