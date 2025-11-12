import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Clock, Users, Share2 } from "lucide-react";

interface TicketBatch {
  id: string;
  batch_name: string;
  sector: string;
  price: number;
  quantity_total: number;
  sale_start_date: string;
  sale_end_date: string;
}

interface EventPreviewProps {
  title: string;
  description: string;
  category: string;
  eventDate: string | Date | undefined;
  venue: string;
  address: string;
  imageUrl: string;
  ticketBatches: TicketBatch[];
}

export const EventPreview = ({
  title,
  description,
  category,
  eventDate,
  venue,
  address,
  imageUrl,
  ticketBatches,
}: EventPreviewProps) => {
  return (
    <div className="max-h-[80vh] overflow-y-auto">
      {/* Event Header */}
      <div className="relative h-[300px] w-full overflow-hidden rounded-t-lg">
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent z-10" />
        <img
          src={imageUrl || "/placeholder.svg"}
          alt={title || "Preview do evento"}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  {category && <Badge>{category}</Badge>}
                  <h1 className="text-3xl md:text-4xl font-bold">{title || "Título do evento"}</h1>
                </div>
                <Button variant="outline" size="icon" disabled>
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
                    <p className="font-semibold">
                      {eventDate
                        ? new Date(eventDate).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })
                        : "Não definida"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Horário</p>
                    <p className="font-semibold">
                      {eventDate
                        ? new Date(eventDate).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "--:--"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Local</p>
                    <p className="font-semibold">{venue || "Não definido"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Capacidade</p>
                    <p className="font-semibold">
                      {ticketBatches.reduce((acc, t) => acc + t.quantity_total, 0)} ingressos
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h2 className="text-2xl font-bold">Sobre o Evento</h2>
              <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-line">
                {description || "Nenhuma descrição fornecida."}
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h2 className="text-2xl font-bold">Localização</h2>
              <p className="text-muted-foreground">{venue || "Não definido"}</p>
              <p className="text-sm text-muted-foreground">{address || "Endereço não informado"}</p>
            </Card>
          </div>

          {/* Sidebar - Ticket Purchase */}
          <div className="lg:col-span-1">
            <Card className="p-6 space-y-6">
              <h2 className="text-2xl font-bold">Ingressos</h2>
              {ticketBatches.length === 0 ? (
                <p className="text-muted-foreground">Nenhum lote de ingressos adicionado.</p>
              ) : (
                <div className="space-y-4">
                  {ticketBatches.map((ticket) => {
                    const now = new Date();
                    const saleStart = new Date(ticket.sale_start_date);
                    const saleEnd = new Date(ticket.sale_end_date);
                    const isSaleActive = now >= saleStart && now <= saleEnd;

                    return (
                      <div
                        key={ticket.id}
                        className="p-4 border rounded-lg border-border"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-semibold">{ticket.batch_name}</h3>
                            {ticket.sector && <p className="text-sm text-muted-foreground">{ticket.sector}</p>}
                            <p className="text-2xl font-bold text-primary">
                              R$ {Number(ticket.price).toFixed(2).replace(".", ",")}
                            </p>
                          </div>
                          {!isSaleActive ? (
                            <Badge variant="secondary">Fora do período</Badge>
                          ) : (
                            <Badge>{ticket.quantity_total} disponíveis</Badge>
                          )}
                        </div>
                        <Button
                          className="w-full"
                          disabled
                          variant={isSaleActive ? "hero" : "secondary"}
                        >
                          {!isSaleActive ? "Fora do período" : "Comprar"}
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
    </div>
  );
};
