import { useState, useEffect, useRef } from "react";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Clock, Users, Share2 } from "lucide-react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { injectSanitizedPixel, removeInjectedPixels } from "@/lib/sanitize-pixels";
import { LocationMap } from "@/components/LocationMap";

const EventDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const utmCode = searchParams.get("utm");
  const [event, setEvent] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [utmLinkId, setUtmLinkId] = useState<string | null>(null);
  const hasTrackedView = useRef(false);
  const pixelsInjected = useRef(false);

  useEffect(() => {
    if (id) {
      fetchEventDetails();
    }
  }, [id]);

  // Fetch UTM link ID if utm code is present
  useEffect(() => {
    const fetchUtmLink = async () => {
      if (!utmCode) return;
      
      try {
        const { data } = await supabase
          .from("utm_links")
          .select("id, applies_to_all_events")
          .eq("utm_code", utmCode)
          .eq("is_active", true)
          .single();

        if (data) {
          // Check if link applies to this event
          if (data.applies_to_all_events) {
            setUtmLinkId(data.id);
          } else {
            // Check if event is in link's selected events
            const { data: linkEvent } = await supabase
              .from("utm_link_events")
              .select("id")
              .eq("utm_link_id", data.id)
              .eq("event_id", id)
              .single();

            if (linkEvent) {
              setUtmLinkId(data.id);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching UTM link:", error);
      }
    };

    fetchUtmLink();
  }, [utmCode, id]);

  const trackPageView = async () => {
    if (hasTrackedView.current) return;
    
    try {
      hasTrackedView.current = true;
      await supabase.from("event_analytics").insert({
        event_id: id,
        event_type: "page_view",
        utm_link_id: utmLinkId,
      });
    } catch (error) {
      console.error("Error tracking page view:", error);
      hasTrackedView.current = false;
    }
  };

  // Inject pixels when event is loaded (now using sanitized injection)
  useEffect(() => {
    if (event && !pixelsInjected.current) {
      pixelsInjected.current = true;
      
      // Inject Google Pixel (sanitized)
      injectSanitizedPixel(event.google_pixel_code, 'google');
      
      // Inject Meta Pixel (sanitized)
      injectSanitizedPixel(event.meta_pixel_code, 'meta');
    }

    // Cleanup function
    return () => {
      removeInjectedPixels();
      pixelsInjected.current = false;
    };
  }, [event]);

  // Track page view after event is loaded and UTM link is resolved
  useEffect(() => {
    if (event && !hasTrackedView.current) {
      // If there's a utm code but utmLinkId isn't resolved yet, wait
      if (utmCode && !utmLinkId) return;
      trackPageView();
    }
  }, [event, utmLinkId, utmCode]);

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

  const handleShare = async () => {
    const eventUrl = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: event?.title || 'Evento',
          text: `Confira este evento: ${event?.title}`,
          url: eventUrl,
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          copyToClipboard(eventUrl);
        }
      }
    } else {
      copyToClipboard(eventUrl);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here if you have the toast hook
    alert('Link copiado para a área de transferência!');
  };

  if (loading) {
    return (
      <>
        <div className="flex-1 flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
        <Footer />
      </>
    );
  }

  if (!event) {
    return null;
  }

  return (
    <>
      <main>
        {/* Event Header */}
        <div className="relative h-[400px] w-full overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent z-10" />
          <img
            src={event.image_url || "/placeholder.svg"}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="container mx-auto px-4 pb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 -mt-10 md:-mt-20 relative z-20">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-4 md:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <Badge>{event.category}</Badge>
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">{event.title}</h1>
                  </div>
                  <Button variant="outline" size="icon" onClick={handleShare}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Data de Início</p>
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
                      <p className="text-sm text-muted-foreground">Horário de Início</p>
                      <p className="font-semibold">{new Date(event.event_date).toLocaleTimeString('pt-BR', { 
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</p>
                    </div>
                  </div>
                  {event.event_end_date && (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Data de Término</p>
                          <p className="font-semibold">{new Date(event.event_end_date).toLocaleDateString('pt-BR', { 
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
                          <p className="text-sm text-muted-foreground">Horário de Término</p>
                          <p className="font-semibold">{new Date(event.event_end_date).toLocaleTimeString('pt-BR', { 
                            hour: '2-digit',
                            minute: '2-digit'
                          })}</p>
                        </div>
                      </div>
                    </>
                  )}
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

              <Card className="p-4 md:p-6 space-y-4">
                <h2 className="text-xl md:text-2xl font-bold">Sobre o Evento</h2>
                <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-line text-sm md:text-base">
                  {event.description}
                </div>
              </Card>

              <Card className="p-4 md:p-6 space-y-4">
                <h2 className="text-xl md:text-2xl font-bold">Localização</h2>
                <p className="text-muted-foreground">{event.venue}</p>
                <p className="text-sm text-muted-foreground">
                  {event.address}
                  {event.address_number && `, ${event.address_number}`}
                  {event.address_complement && ` - ${event.address_complement}`}
                </p>
                <LocationMap 
                  address={event.address}
                  addressNumber={event.address_number}
                  venue={event.venue}
                />
              </Card>
            </div>

            {/* Sidebar - Ticket Purchase */}
            <div className="lg:col-span-1">
              <Card className="p-4 md:p-6 space-y-6 lg:sticky lg:top-20">
                <h2 className="text-xl md:text-2xl font-bold">Ingressos</h2>
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
                              <h3 className="font-semibold text-sm md:text-base">{ticket.batch_name}</h3>
                              {ticket.sector && <p className="text-xs md:text-sm text-muted-foreground">{ticket.sector}</p>}
                              <p className="text-xl md:text-2xl font-bold text-primary">
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
                            onClick={async () => {
                              if (isAvailable && isSaleActive) {
                                try {
                                  await supabase.from("event_analytics").insert({
                                    event_id: id,
                                    event_type: "ticket_click",
                                    ticket_id: ticket.id,
                                    utm_link_id: utmLinkId,
                                  });
                                } catch (error) {
                                  console.error("Error tracking ticket click:", error);
                                }
                                const checkoutUrl = utmCode 
                                  ? `/checkout/${id}?ticket=${ticket.id}&utm=${utmCode}`
                                  : `/checkout/${id}?ticket=${ticket.id}`;
                                navigate(checkoutUrl);
                              }
                            }}
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
    </>
  );
};

export default EventDetails;
