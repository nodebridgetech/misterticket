import { Footer } from "@/components/Footer";
import { EventCard } from "@/components/EventCard";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Shield, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-concert.jpg";
import event1 from "@/assets/event-1.jpg";
import event2 from "@/assets/event-2.jpg";
import event3 from "@/assets/event-3.jpg";

const Index = () => {
  const featuredEvents = [
    {
      id: "1",
      title: "Festival de Música Eletrônica 2025",
      image: event1,
      date: "15 de Fevereiro, 2025",
      location: "São Paulo, SP",
      price: "A partir de R$ 120,00",
      category: "Música",
    },
    {
      id: "2",
      title: "Stand-Up Comedy Night",
      image: event2,
      date: "22 de Fevereiro, 2025",
      location: "Rio de Janeiro, RJ",
      price: "A partir de R$ 80,00",
      category: "Comédia",
    },
    {
      id: "3",
      title: "Rock Festival 2025",
      image: event3,
      date: "10 de Março, 2025",
      location: "Belo Horizonte, MG",
      price: "A partir de R$ 150,00",
      category: "Música",
    },
  ];

  return (
    <>

      {/* Hero Section */}
      <section className="relative h-[600px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-60 z-10" />
        <img
          src={heroImage}
          alt="Hero"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="container mx-auto px-4 relative z-20 text-center text-white">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 drop-shadow-lg">
            Seu evento começa aqui
          </h1>
          <p className="text-xl md:text-2xl mb-8 drop-shadow-md max-w-2xl mx-auto">
            A plataforma completa para criar, gerenciar e vender ingressos para seus eventos
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="hero" size="lg" asChild>
              <Link to="/events">
                Explorar Eventos
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="bg-background/10 backdrop-blur text-white border-white hover:bg-white hover:text-foreground" asChild>
              <Link to="/create-event">Criar Evento</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Por que escolher o Mister Ticket?</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Tudo que você precisa para criar experiências inesquecíveis
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Rápido e Fácil</h3>
              <p className="text-muted-foreground">
                Crie e publique seu evento em minutos. Interface intuitiva e processo simplificado.
              </p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Seguro e Confiável</h3>
              <p className="text-muted-foreground">
                Pagamentos seguros e validação de ingressos com QR Code único e intransferível.
              </p>
            </div>
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Calendar className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Gestão Completa</h3>
              <p className="text-muted-foreground">
                Dashboard com métricas, vendas e controle total sobre seus eventos e ingressos.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Events */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-2">Eventos em Destaque</h2>
              <p className="text-muted-foreground">Descubra os melhores eventos perto de você</p>
            </div>
            <Button variant="ghost" asChild>
              <Link to="/events">
                Ver todos
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredEvents.map((event) => (
              <EventCard key={event.id} {...event} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-primary text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Pronto para criar seu evento?
          </h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Junte-se a milhares de produtores que confiam no Mister Ticket para gerenciar seus eventos
          </p>
          <Button size="lg" variant="outline" className="bg-white text-foreground hover:bg-white/90" asChild>
            <Link to="/create-event">Começar Agora</Link>
          </Button>
        </div>
      </section>

      <Footer />
    </>
  );
};

export default Index;
