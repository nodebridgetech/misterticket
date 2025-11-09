import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Clock, Users, Share2 } from "lucide-react";
import { useParams } from "react-router-dom";
import event1 from "@/assets/event-1.jpg";

const EventDetails = () => {
  const { id } = useParams();

  // Mock data - will be replaced with real data later
  const event = {
    id,
    title: "Festival de Música Eletrônica 2025",
    image: event1,
    category: "Música",
    date: "15 de Fevereiro, 2025",
    time: "20:00",
    location: "Arena Anhembi - São Paulo, SP",
    address: "Av. Olavo Fontoura, 1209 - Santana, São Paulo - SP",
    description: `Prepare-se para uma noite inesquecível no maior festival de música eletrônica do Brasil! 

Com mais de 12 horas de música ininterrupta, os melhores DJs nacionais e internacionais se reunem para proporcionar uma experiência única.

O festival conta com 3 palcos simultâneos, área VIP com open bar, food trucks gourmet e muito mais. Não perca esta oportunidade!`,
    organizer: "Produtora XYZ Events",
    capacity: 5000,
    sold: 3200,
    batches: [
      { id: 1, name: "1º Lote - Pista", price: "R$ 120,00", available: 0, total: 1000 },
      { id: 2, name: "2º Lote - Pista", price: "R$ 150,00", available: 300, total: 1500 },
      { id: 3, name: "1º Lote - VIP", price: "R$ 280,00", available: 150, total: 500 },
    ],
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Event Header */}
        <div className="relative h-[400px] w-full overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent z-10" />
          <img
            src={event.image}
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
                    <p className="text-muted-foreground">por {event.organizer}</p>
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
                      <p className="font-semibold">{event.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Horário</p>
                      <p className="font-semibold">{event.time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Local</p>
                      <p className="font-semibold">{event.location}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Ingressos</p>
                      <p className="font-semibold">{event.sold} vendidos</p>
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
                <p className="text-muted-foreground">{event.address}</p>
                <div className="w-full h-64 bg-secondary rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground">Mapa será exibido aqui</p>
                </div>
              </Card>
            </div>

            {/* Sidebar - Ticket Purchase */}
            <div className="lg:col-span-1">
              <Card className="p-6 space-y-6 sticky top-20">
                <h2 className="text-2xl font-bold">Ingressos</h2>
                <div className="space-y-4">
                  {event.batches.map((batch) => (
                    <div
                      key={batch.id}
                      className={`p-4 border rounded-lg ${
                        batch.available > 0
                          ? "border-border hover:border-primary transition-colors cursor-pointer"
                          : "border-border opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold">{batch.name}</h3>
                          <p className="text-2xl font-bold text-primary">{batch.price}</p>
                        </div>
                        {batch.available === 0 ? (
                          <Badge variant="secondary">Esgotado</Badge>
                        ) : (
                          <Badge>{batch.available} disponíveis</Badge>
                        )}
                      </div>
                      <Button
                        className="w-full"
                        disabled={batch.available === 0}
                        variant={batch.available > 0 ? "hero" : "secondary"}
                      >
                        {batch.available > 0 ? "Comprar" : "Esgotado"}
                      </Button>
                    </div>
                  ))}
                </div>
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
