import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { EventCard } from "@/components/EventCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Events = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") || "all");

  const [events, setEvents] = useState<any[]>([]);
  const [eventsWithPrices, setEventsWithPrices] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
    fetchCategories();
  }, []);

  useEffect(() => {
    const search = searchParams.get("search");
    const category = searchParams.get("category");
    if (search) {
      setSearchTerm(search);
    }
    if (category) {
      setSelectedCategory(category);
    }
  }, [searchParams]);

  const fetchEvents = async () => {
    try {
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("is_published", true)
        .order("event_date", { ascending: true });

      if (data) {
        setEvents(data);
        // Fetch prices for all events
        const withPrices = await Promise.all(
          data.map(async (event) => {
            const { data: tickets } = await supabase
              .from("tickets")
              .select("price")
              .eq("event_id", event.id)
              .order("price", { ascending: true })
              .limit(1);

            const minPrice = tickets && tickets.length > 0 ? tickets[0].price : null;
            return {
              ...event,
              price: minPrice ? `A partir de R$ ${Number(minPrice).toFixed(2).replace('.', ',')}` : "Consultar",
            };
          })
        );
        setEventsWithPrices(withPrices);
      }
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await supabase
        .from("categories")
        .select("name")
        .order("name");

      if (data) {
        setCategories(["all", ...data.map(c => c.name)]);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const filteredEvents = eventsWithPrices.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.venue?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.address?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || event.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <>
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-6">Todos os Eventos</h1>
          
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar por evento ou cidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.filter(c => c !== "all").map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Carregando eventos...</p>
          </div>
        ) : filteredEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => (
              <EventCard 
                key={event.id} 
                id={event.id}
                title={event.title}
                date={new Date(event.event_date).toLocaleDateString('pt-BR')}
                location={`${event.venue} - ${event.address}`}
                price={event.price}
                image={event.image_url || "/placeholder.svg"}
                category={event.category}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">
              Nenhum evento encontrado com os filtros selecionados.
            </p>
          </div>
        )}
      </main>

      <Footer />
    </>
  );
};

export default Events;
