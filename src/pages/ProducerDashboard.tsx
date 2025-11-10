import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Users, DollarSign, TrendingUp, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ProducerDashboard = () => {
  const { user, isProducerApproved, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && (!user || !isProducerApproved)) {
      navigate("/minha-conta");
    }
  }, [user, isProducerApproved, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!isProducerApproved) {
    return null;
  }

  const [myEvents, setMyEvents] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (user && isProducerApproved) {
      fetchMyEvents();
    }
  }, [user, isProducerApproved]);

  const fetchMyEvents = async () => {
    try {
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("producer_id", user?.id)
        .order("created_at", { ascending: false });

      if (data) {
        setMyEvents(data);
      }
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleDeleteEvent = async (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm("Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita.")) {
      return;
    }

    try {
      // First delete all tickets
      await supabase.from("tickets").delete().eq("event_id", eventId);
      
      // Then delete the event
      const { error } = await supabase.from("events").delete().eq("id", eventId);

      if (error) throw error;

      toast({
        title: "Evento excluído",
        description: "O evento foi excluído com sucesso",
      });

      fetchMyEvents();
    } catch (error) {
      console.error("Error deleting event:", error);
      toast({
        title: "Erro ao excluir evento",
        description: "Ocorreu um erro ao excluir o evento",
        variant: "destructive",
      });
    }
  };

  const stats = [
    {
      title: "Eventos Ativos",
      value: myEvents.filter(e => e.is_published).length.toString(),
      icon: CalendarDays,
      description: "eventos publicados",
    },
    {
      title: "Total de Vendas",
      value: "0",
      icon: Users,
      description: "ingressos vendidos",
    },
    {
      title: "Receita Total",
      value: "R$ 0,00",
      icon: DollarSign,
      description: "bruto",
    },
    {
      title: "Taxa Média",
      value: "0%",
      icon: TrendingUp,
      description: "de conversão",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Painel do Produtor</h1>
            <p className="text-muted-foreground">
              Gerencie seus eventos e acompanhe suas vendas
            </p>
          </div>
          <Button size="lg" className="gap-2" onClick={() => navigate("/criar-evento")}>
            <Plus className="h-5 w-5" />
            Criar Evento
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Meus Eventos</CardTitle>
              <CardDescription>
                Lista dos seus eventos publicados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingData ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Carregando...</p>
                </div>
              ) : myEvents.length === 0 ? (
                <div className="text-center py-12">
                  <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Você ainda não criou nenhum evento
                  </p>
                  <Button onClick={() => navigate("/criar-evento")}>Criar meu primeiro evento</Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Publicado</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myEvents.map((event) => (
                      <TableRow 
                        key={event.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/evento/${event.id}`)}
                      >
                        <TableCell className="font-medium">{event.title}</TableCell>
                        <TableCell>{new Date(event.event_date).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>
                          <Badge variant={event.is_published ? 'default' : 'outline'}>
                            {event.is_published ? 'Sim' : 'Não'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/editar-evento/${event.id}`);
                              }}
                            >
                              Editar
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => handleDeleteEvent(event.id, e)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Solicitações de Saque</CardTitle>
              <CardDescription>
                Histórico de saques e repasses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma solicitação de saque pendente
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProducerDashboard;
