import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Eye, Star, Filter, ArrowUpDown, Edit, BarChart3 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";

export const EventManagementTab = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [updatingFeatured, setUpdatingFeatured] = useState<string | null>(null);
  const [updatingTrending, setUpdatingTrending] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination, filter and sort states
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [featuredFilter, setFeaturedFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date-asc");
  const itemsPerPage = 10;

  // Get unique categories
  const [categories, setCategories] = useState<string[]>([]);

  // Fetch events
  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Erro ao carregar eventos",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setEvents(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    const uniqueCategories = Array.from(new Set(events.map(e => e.category)));
    setCategories(uniqueCategories);
  }, [events]);

  // Filter and sort events
  const filteredEvents = events
    .filter((event) => {
      const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          event.venue.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === "all" || event.category === categoryFilter;
      const matchesStatus = statusFilter === "all" || 
                          (statusFilter === "published" && event.is_published) ||
                          (statusFilter === "draft" && !event.is_published);
      const matchesFeatured = featuredFilter === "all" ||
                            (featuredFilter === "featured" && event.is_featured) ||
                            (featuredFilter === "not-featured" && !event.is_featured);
      
      return matchesSearch && matchesCategory && matchesStatus && matchesFeatured;
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
        case "category-asc":
          return a.category.localeCompare(b.category);
        case "category-desc":
          return b.category.localeCompare(a.category);
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
  }, [searchTerm, categoryFilter, statusFilter, featuredFilter, sortBy]);

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

      fetchEvents();
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

      fetchEvents();
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

  const handleToggleTrending = async (eventId: string, currentValue: boolean) => {
    setUpdatingTrending(eventId);
    try {
      const { error } = await supabase
        .from("events")
        .update({ is_trending: !currentValue })
        .eq("id", eventId);

      if (error) throw error;

      toast({
        title: currentValue ? "Evento removido de Em Alta" : "Evento marcado como Em Alta",
        description: currentValue 
          ? "O evento não aparecerá mais na seção Eventos em Alta." 
          : "O evento será exibido na seção Eventos em Alta da página inicial.",
      });

      fetchEvents();
    } catch (error) {
      console.error("Error updating trending status:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status de Em Alta.",
        variant: "destructive",
      });
    } finally {
      setUpdatingTrending(null);
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
        <CardContent className="space-y-4">
          {/* Filters and Search */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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

            <Select value={featuredFilter} onValueChange={setFeaturedFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Destaque" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="featured">Em destaque</SelectItem>
                <SelectItem value="not-featured">Não destacado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label>Ordenar por:</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-asc">Data (mais antigo)</SelectItem>
                  <SelectItem value="date-desc">Data (mais recente)</SelectItem>
                  <SelectItem value="title-asc">Título (A-Z)</SelectItem>
                  <SelectItem value="title-desc">Título (Z-A)</SelectItem>
                  <SelectItem value="category-asc">Categoria (A-Z)</SelectItem>
                  <SelectItem value="category-desc">Categoria (Z-A)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground">
              {filteredEvents.length} evento(s) encontrado(s)
            </div>
          </div>

          {/* Table */}
          {currentEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum evento encontrado
            </div>
          ) : (
            <>
              <div className="md:hidden space-y-3">
                {currentEvents.map((event) => (
                  <Card key={event.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-sm line-clamp-2 flex-1">
                          {event.title}
                        </h3>
                        {event.is_published ? (
                          <Badge variant="default" className="flex-shrink-0 text-xs">Publicado</Badge>
                        ) : (
                          <Badge variant="secondary" className="flex-shrink-0 text-xs">Rascunho</Badge>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs">{event.category}</Badge>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {format(new Date(event.event_date), "dd/MM/yyyy HH:mm")}
                      </div>

                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Destaque:</Label>
                        <Switch
                          checked={event.is_featured}
                          onCheckedChange={() => handleToggleFeatured(event.id, event.is_featured)}
                          disabled={updatingFeatured === event.id}
                        />
                        {event.is_featured && (
                          <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Em Alta:</Label>
                        <Switch
                          checked={event.is_trending}
                          onCheckedChange={() => handleToggleTrending(event.id, event.is_trending)}
                          disabled={updatingTrending === event.id}
                        />
                        {event.is_trending && (
                          <span className="text-xs">🔥</span>
                        )}
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => navigate(`/event/${event.id}`)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => navigate(`/editar-evento/${event.id}`)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => navigate(`/event-analytics/${event.id}`)}
                        >
                          <BarChart3 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="text-xs"
                          onClick={() => setEventToDelete(event.id)}
                          disabled={deleting === event.id}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Data do Evento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Destaque</TableHead>
                      <TableHead>Em Alta</TableHead>
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
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={event.is_trending}
                              onCheckedChange={() => handleToggleTrending(event.id, event.is_trending)}
                              disabled={updatingTrending === event.id}
                            />
                            {event.is_trending && (
                              <span>🔥</span>
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
                            variant="outline"
                            onClick={() => navigate(`/editar-evento/${event.id}`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/event-analytics/${event.id}`)}
                          >
                            <BarChart3 className="h-4 w-4" />
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
              </div>

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
                      // Show first, last, current, and pages around current
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
