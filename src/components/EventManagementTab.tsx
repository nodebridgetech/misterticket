import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Eye, Star } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EventManagementTabProps {
  events: any[];
  onRefresh: () => void;
}

export const EventManagementTab = ({ events, onRefresh }: EventManagementTabProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [updatingFeatured, setUpdatingFeatured] = useState<string | null>(null);

  const handleDelete = async (eventId: string) => {
    setDeleting(eventId);
    try {
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", eventId);

      if (error) throw error;

      toast({
        title: "Evento excluído",
        description: "O evento foi removido com sucesso.",
      });

      onRefresh();
    } catch (error) {
      console.error("Error deleting event:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o evento.",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
      setEventToDelete(null);
    }
  };

  const handleToggleFeatured = async (eventId: string, currentValue: boolean) => {
    setUpdatingFeatured(eventId);
    try {
      const { error } = await supabase
        .from("events")
        .update({ is_featured: !currentValue })
        .eq("id", eventId);

      if (error) throw error;

      toast({
        title: currentValue ? "Evento removido dos destaques" : "Evento marcado como destaque",
        description: currentValue 
          ? "O evento não aparecerá mais prioritariamente no banner." 
          : "O evento será priorizado no banner da página inicial.",
      });

      onRefresh();
    } catch (error) {
      console.error("Error updating featured status:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status de destaque.",
        variant: "destructive",
      });
    } finally {
      setUpdatingFeatured(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Gerenciamento de Eventos</CardTitle>
          <CardDescription>
            Visualize e gerencie todos os eventos da plataforma
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum evento cadastrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Data do Evento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Destaque</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">{event.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{event.category}</Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(event.event_date), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      {event.is_published ? (
                        <Badge variant="default">Publicado</Badge>
                      ) : (
                        <Badge variant="secondary">Rascunho</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={event.is_featured}
                          onCheckedChange={() => handleToggleFeatured(event.id, event.is_featured)}
                          disabled={updatingFeatured === event.id}
                        />
                        {event.is_featured && (
                          <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/event/${event.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setEventToDelete(event.id)}
                        disabled={deleting === event.id}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Excluir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!eventToDelete} onOpenChange={() => setEventToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O evento será permanentemente excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => eventToDelete && handleDelete(eventToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
