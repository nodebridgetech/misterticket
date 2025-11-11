import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Plus, Trash2, Copy, Edit, Power } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const MyEvents = () => {
  const { user, isProducerApproved, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [myEvents, setMyEvents] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [togglingActive, setTogglingActive] = useState<string | null>(null);
  
  // Pagination, filter and sort states
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date-desc");
  const itemsPerPage = 10;

  // Get unique categories
  const [categories, setCategories] = useState<string[]>([]);

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

  useEffect(() => {
    const uniqueCategories = Array.from(new Set(myEvents.map(e => e.category)));
    setCategories(uniqueCategories);
  }, [myEvents]);

  // Filter and sort events
  const filteredEvents = myEvents
    .filter((event) => {
      const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          event.venue.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === "all" || event.category === categoryFilter;
      const matchesStatus = statusFilter === "all" || 
                          (statusFilter === "published" && event.is_published) ||
                          (statusFilter === "draft" && !event.is_published);
      const matchesActive = activeFilter === "all" ||
                          (activeFilter === "active" && event.is_active) ||
                          (activeFilter === "inactive" && !event.is_active);
      
      return matchesSearch && matchesCategory && matchesStatus && matchesActive;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "date-asc":
          return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
        case "date-desc":
          return new Date(b.event_date).getTime() - new Date(a.event_date).getTime();
        case "title-asc":
          return a.title.localeCompare(b.title);
        case "title-desc":
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });

  // Pagination
  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentEvents = filteredEvents.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, statusFilter, activeFilter, sortBy]);

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

  const handleDeleteEvent = async (eventId: string) => {
    setDeleting(eventId);
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
    } finally {
      setDeleting(null);
      setEventToDelete(null);
    }
  };

  const handleToggleActive = async (eventId: string, currentValue: boolean) => {
    setTogglingActive(eventId);
    try {
      const { error } = await supabase
        .from("events")
        .update({ is_active: !currentValue })
        .eq("id", eventId);

      if (error) throw error;

      toast({
        title: currentValue ? "Evento inativado" : "Evento reativado",
        description: currentValue 
          ? "O evento não estará mais visível para visitantes." 
          : "O evento voltou a ficar visível para visitantes.",
      });

      fetchMyEvents();
    } catch (error) {
      console.error("Error updating active status:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do evento.",
        variant: "destructive",
      });
    } finally {
      setTogglingActive(null);
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
    <>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <Button size="lg" className="gap-2" onClick={() => navigate("/criar-evento")}>
            <Plus className="h-5 w-5" />
            Criar Evento
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Filters and Search */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <Input
                  placeholder="Buscar por título ou local..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="published">Publicado</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label>Ordenar por:</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date-desc">Data (mais recente)</SelectItem>
                      <SelectItem value="date-asc">Data (mais antigo)</SelectItem>
                      <SelectItem value="title-asc">Título (A-Z)</SelectItem>
                      <SelectItem value="title-desc">Título (Z-A)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Select value={activeFilter} onValueChange={setActiveFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status ativo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Ativos</SelectItem>
                    <SelectItem value="inactive">Inativos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="text-sm text-muted-foreground">
                {filteredEvents.length} evento(s) encontrado(s)
              </div>
            </div>

            {/* Table */}
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
            ) : currentEvents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum evento encontrado
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Data do Evento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentEvents.map((event) => (
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
                          <Button
                            size="sm"
                            variant={event.is_active ? "default" : "outline"}
                            onClick={() => handleToggleActive(event.id, event.is_active)}
                            disabled={togglingActive === event.id}
                          >
                            <Power className="h-4 w-4 mr-1" />
                            {event.is_active ? "Ativo" : "Inativo"}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/editar-evento/${event.id}`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateEvent(event.id, e);
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setEventToDelete(event.id)}
                            disabled={deleting === event.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                        if (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1)
                        ) {
                          return (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => setCurrentPage(page)}
                                isActive={currentPage === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        } else if (page === currentPage - 2 || page === currentPage + 2) {
                          return (
                            <PaginationItem key={page}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          );
                        }
                        return null;
                      })}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

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
              onClick={() => eventToDelete && handleDeleteEvent(eventToDelete)}
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

export default MyEvents;
