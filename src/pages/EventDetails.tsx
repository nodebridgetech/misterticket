import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Clock, Users, Share2 } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const EventDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchEventDetails();
    }
  }, [id]);

  const fetchEventDetails = async () => {
    try {
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (eventError) throw eventError;
      
      if (!eventData) {
        navigate("/404");
        return;
      }

      setEvent(eventData);

      const { data: ticketsData } = await supabase
        .from("tickets")
        .select("*")
        .eq("event_id", id)
        .order("price", { ascending: true });

      if (ticketsData) {
        setTickets(ticketsData);
      }
    } catch (error) {
      console.error("Error fetching event:", error);
      navigate("/404");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (!event) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Event Header */}
        <div className="relative h-[400px] w-full overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent z-10" />
          <img
            src={event.image_url || "/placeholder.svg"}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="container mx-auto px-4 -mt-20 relative z-20">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <Badge>{event.category}</Badge>
                    <h1 className="text-3xl md:text-4xl font-bold">{event.title}</h1>
                  </div>
                  <Button variant="outline" size="icon">
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Data</p>
                      <p className="font-semibold">{new Date(event.event_date).toLocaleDateString('pt-BR', { 
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Horário</p>
                      <p className="font-semibold">{new Date(event.event_date).toLocaleTimeString('pt-BR', { 
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Local</p>
                      <p className="font-semibold">{event.venue}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Capacidade</p>
                      <p className="font-semibold">{tickets.reduce((acc, t) => acc + t.quantity_total, 0)} ingressos</p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6 space-y-4">
                <h2 className="text-2xl font-bold">Sobre o Evento</h2>
                <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-line">
                  {event.description}
                </div>
              </Card>

              <Card className="p-6 space-y-4">
                <h2 className="text-2xl font-bold">Localização</h2>
                <p className="text-muted-foreground">{event.venue}</p>
                <p className="text-sm text-muted-foreground">{event.address}</p>
              </Card>
            </div>

            {/* Sidebar - Ticket Purchase */}
            <div className="lg:col-span-1">
              <Card className="p-6 space-y-6 sticky top-20">
                <h2 className="text-2xl font-bold">Ingressos</h2>
                {tickets.length === 0 ? (
                  <p className="text-muted-foreground">Nenhum lote de ingressos disponível no momento.</p>
                ) : (
                  <div className="space-y-4">
                    {tickets.map((ticket) => {
                      const available = ticket.quantity_total - ticket.quantity_sold;
                      const isAvailable = available > 0;
                      const now = new Date();
                      const saleStart = new Date(ticket.sale_start_date);
                      const saleEnd = new Date(ticket.sale_end_date);
                      const isSaleActive = now >= saleStart && now <= saleEnd;

                      return (
                        <div
                          key={ticket.id}
                          className={`p-4 border rounded-lg ${
                            isAvailable && isSaleActive
                              ? "border-border hover:border-primary transition-colors cursor-pointer"
                              : "border-border opacity-50 cursor-not-allowed"
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-semibold">{ticket.batch_name}</h3>
                              {ticket.sector && <p className="text-sm text-muted-foreground">{ticket.sector}</p>}
                              <p className="text-2xl font-bold text-primary">
                                R$ {Number(ticket.price).toFixed(2).replace('.', ',')}
                              </p>
                            </div>
                            {!isSaleActive ? (
                              <Badge variant="secondary">Fora do período</Badge>
                            ) : !isAvailable ? (
                              <Badge variant="secondary">Esgotado</Badge>
                            ) : (
                              <Badge>{available} disponíveis</Badge>
                            )}
                          </div>
                          <Button
                            className="w-full"
                            disabled={!isAvailable || !isSaleActive}
                            variant={isAvailable && isSaleActive ? "hero" : "secondary"}
                          >
                            {!isSaleActive ? "Fora do período" : isAvailable ? "Comprar" : "Esgotado"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="pt-4 border-t space-y-2 text-sm text-muted-foreground">
                  <p>✓ Ingressos digitais com QR Code</p>
                  <p>✓ Entrega imediata por e-mail</p>
                  <p>✓ Pagamento 100% seguro</p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default EventDetails;
