import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Plus, Trash2, Copy, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const MyEvents = () => {
  const { user, isProducerApproved, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [myEvents, setMyEvents] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && (!user || !isProducerApproved)) {
      navigate("/minha-conta");
    }
  }, [user, isProducerApproved, loading, navigate]);

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
      await supabase.from("tickets").delete().eq("event_id", eventId);
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

  const handleDuplicateEvent = async (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (eventError) throw eventError;

      const { data: tickets, error: ticketsError } = await supabase
        .from("tickets")
        .select("*")
        .eq("event_id", eventId);

      if (ticketsError) throw ticketsError;

      navigate("/criar-evento", { 
        state: { 
          duplicateFrom: {
            ...event,
            tickets: tickets || []
          }
        } 
      });
    } catch (error) {
      console.error("Error duplicating event:", error);
      toast({
        title: "Erro ao duplicar evento",
        description: "Ocorreu um erro ao duplicar o evento",
        variant: "destructive",
      });
    }
  };

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

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Meus Eventos</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie todos os seus eventos
          </p>
        </div>
        <Button size="lg" className="gap-2" onClick={() => navigate("/criar-evento")}>
          <Plus className="h-5 w-5" />
          Criar Evento
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Eventos</CardTitle>
          <CardDescription>
            Todos os seus eventos criados
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
                    onClick={() => navigate(`/event/${event.id}`)}
                  >
                    <TableCell className="font-medium">{event.title}</TableCell>
                    <TableCell>
                      {new Date(event.event_date).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={event.is_published ? "default" : "secondary"}>
                        {event.is_published ? "Sim" : "Não"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/editar-evento/${event.id}`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDuplicateEvent(event.id, e)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDeleteEvent(event.id, e)}
                        >
                          <Trash2 className="h-4 w-4" />
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
    </div>
  );
};

export default MyEvents;
