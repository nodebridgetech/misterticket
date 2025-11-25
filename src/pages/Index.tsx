import { Footer } from "@/components/Footer";
import { EventCard } from "@/components/EventCard";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  CarouselApi,
} from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";

interface Event {
  id: string;
  title: string;
  image_url: string | null;
  event_date: string;
  event_end_date: string | null;
  venue: string;
  address: string;
  category: string;
}

interface EventWithPrice extends Event {
  price: string;
}

interface Category {
  id: string;
  name: string;
  image_url: string | null;
}

const Index = () => {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [trendingEvents, setTrendingEvents] = useState<EventWithPrice[]>([]);
  const [recentEvents, setRecentEvents] = useState<EventWithPrice[]>([]);
  const [allEvents, setAllEvents] = useState<EventWithPrice[]>([]);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [categoryCarouselApi, setCategoryCarouselApi] = useState<CarouselApi>();

  // Redirect authenticated users to their dashboard
  useEffect(() => {
    if (userRole === "admin") {
      navigate("/admin");
    } else if (userRole === "producer") {
      navigate("/painel");
    }
  }, [userRole, navigate]);

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-play carousel
  useEffect(() => {
    if (!carouselApi) return;

    const interval = setInterval(() => {
      carouselApi.scrollNext();
    }, 5000);

    return () => clearInterval(interval);
  }, [carouselApi]);

  const getEventPrice = async (eventId: string): Promise<string> => {
    const { data: tickets } = await supabase
      .from("tickets")
      .select("price")
      .eq("event_id", eventId)
      .order("price", { ascending: true })
      .limit(1);

    const minPrice = tickets && tickets.length > 0 ? tickets[0].price : null;
    return minPrice ? `A partir de R$ ${Number(minPrice).toFixed(2).replace('.', ',')}` : "Consultar";
  };

  const enrichEventsWithPrice = async (events: Event[]): Promise<EventWithPrice[]> => {
    const eventsWithPrice = await Promise.all(
      events.map(async (event) => ({
        ...event,
        price: await getEventPrice(event.id),
      }))
    );
    return eventsWithPrice;
  };

  const fetchData = async () => {
    setLoading(true);
    const now = new Date().toISOString();

    // Featured events - prioritize events marked as featured, then by date
    const { data: featured } = await supabase
      .from("events")
      .select("*")
      .eq("is_published", true)
      .gte("event_date", now)
      .order("is_featured", { ascending: false, nullsFirst: false })
      .order("event_date", { ascending: true })
      .limit(5);

    // Categories
    const { data: cats } = await supabase
      .from("categories")
      .select("*")
      .order("position", { ascending: true, nullsFirst: false })
      .order("name");

    // Eventos em alta
    const { data: trending } = await supabase
      .from("events")
      .select("*")
      .eq("is_published", true)
      .eq("is_trending", true)
      .gte("event_date", now)
      .order("event_date", { ascending: true })
      .limit(6);

    // Eventos publicados recentemente
    const { data: recent } = await supabase
      .from("events")
      .select("*")
      .eq("is_published", true)
      .gte("event_date", now)
      .order("created_at", { ascending: false })
      .limit(6);

    // Todos os eventos
    const { data: all } = await supabase
      .from("events")
      .select("*")
      .eq("is_published", true)
      .gte("event_date", now)
      .order("event_date", { ascending: true });

    setFeaturedEvents(featured || []);
    setCategories(cats || []);
    
    // Enrich events with prices
    if (trending) setTrendingEvents(await enrichEventsWithPrice(trending));
    if (recent) setRecentEvents(await enrichEventsWithPrice(recent));
    if (all) setAllEvents(await enrichEventsWithPrice(all));
    
    setLoading(false);
  };

  const formatEventCard = (event: EventWithPrice) => ({
    id: event.id,
    title: event.title,
    image: event.image_url || "/placeholder.svg",
    date: format(new Date(event.event_date), "dd 'de' MMMM, yyyy", { locale: ptBR }),
    endDate: event.event_end_date ? format(new Date(event.event_end_date), "dd 'de' MMMM, yyyy", { locale: ptBR }) : undefined,
    location: `${event.venue}, ${event.address}`,
    price: event.price,
    category: event.category,
  });

  if (loading) {
    return (
      <>
        {/* Banner Skeleton */}
        <section className="relative bg-secondary/20">
          <div className="container mx-auto px-4 py-8">
            <Skeleton className="w-full h-[400px] md:h-[500px] rounded-lg" />
          </div>
        </section>

        {/* Categories Skeleton */}
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4">
            <Skeleton className="h-10 w-48 mx-auto mb-8" />
            <div className="flex gap-4 justify-center">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="w-32 h-32 rounded-lg" />
              ))}
            </div>
          </div>
        </section>

        {/* Events Skeleton */}
        <section className="py-16 bg-secondary/20">
          <div className="container mx-auto px-4">
            <Skeleton className="h-10 w-64 mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-64 rounded-lg" />
              ))}
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      {/* Banner Carousel Section */}
      <section className="relative bg-secondary/20">
        <div className="container mx-auto px-4 py-8">
          <Carousel
            setApi={setCarouselApi}
            opts={{ loop: true }}
            className="w-full"
          >
            <CarouselContent>
              {featuredEvents.map((event) => (
                <CarouselItem key={event.id}>
                  <Link to={`/event/${event.id}`}>
                    <div className="relative h-[400px] md:h-[500px] rounded-lg overflow-hidden">
                      <img
                        src={event.image_url || "/placeholder.svg"}
                        alt={event.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 text-white">
                        <h2 className="text-2xl md:text-3xl lg:text-5xl font-bold mb-2">{event.title}</h2>
                        <p className="text-base md:text-lg lg:text-xl mb-1">
                          {format(new Date(event.event_date), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                        </p>
                        <p className="text-sm md:text-base lg:text-lg">{event.venue} - {event.address}</p>
                      </div>
                    </div>
                  </Link>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-4" />
            <CarouselNext className="right-4" />
          </Carousel>
        </div>
      </section>

      {/* Categories Carousel Section */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8 text-center">Categorias</h2>
          <Carousel
            setApi={setCategoryCarouselApi}
            opts={{
              align: "start",
              loop: false,
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-2 md:-ml-4">
              {categories.map((category) => (
                <CarouselItem key={category.id} className="pl-2 md:pl-4 basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/6">
                  <Link
                    to={`/eventos?category=${encodeURIComponent(category.name)}`}
                    className="group block"
                  >
                    <div className="flex items-center justify-center p-3 rounded-lg border border-border bg-card hover:bg-accent hover:shadow-md transition-all min-h-[60px]">
                      <span className="text-sm font-medium text-center">{category.name}</span>
                    </div>
                  </Link>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden md:flex -left-4" />
            <CarouselNext className="hidden md:flex -right-4" />
          </Carousel>
        </div>
      </section>

      {/* Trending Events */}
      {trendingEvents.length > 0 && (
        <section className="py-16 bg-secondary/20">
          <div className="container mx-auto px-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold mb-2">🔥 Eventos em Alta</h2>
                <p className="text-sm md:text-base text-muted-foreground">Os eventos mais procurados do momento</p>
              </div>
              <Button variant="ghost" asChild className="self-start sm:self-auto">
                <Link to="/eventos">
                  Ver todos
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trendingEvents.map((event) => (
                <EventCard key={event.id} {...formatEventCard(event)} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Recently Published Events */}
      {recentEvents.length > 0 && (
        <section className="py-16 bg-secondary/20">
          <div className="container mx-auto px-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold mb-2">Publicados recentemente</h2>
                <p className="text-sm md:text-base text-muted-foreground">Novos eventos na plataforma</p>
              </div>
              <Button variant="ghost" asChild className="self-start sm:self-auto">
                <Link to="/eventos">
                  Ver todos
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentEvents.map((event) => (
                <EventCard key={event.id} {...formatEventCard(event)} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* All Events */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">Todos os eventos</h2>
            <p className="text-sm md:text-base text-muted-foreground">Explore todos os eventos disponíveis</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allEvents.map((event) => (
              <EventCard key={event.id} {...formatEventCard(event)} />
            ))}
          </div>
          {allEvents.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhum evento disponível no momento</p>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </>
  );
};

export default Index;
