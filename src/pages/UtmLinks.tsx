import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, BarChart3, Link, Copy, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

interface UtmLink {
  id: string;
  name: string;
  utm_code: string;
  applies_to_all_events: boolean;
  is_active: boolean;
  created_at: string;
  events?: { id: string; title: string }[];
}

interface Event {
  id: string;
  title: string;
}

const ITEMS_PER_PAGE = 10;

const UtmLinks = () => {
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [utmLinks, setUtmLinks] = useState<UtmLink[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<UtmLink | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [utmCode, setUtmCode] = useState("");
  const [appliesToAll, setAppliesToAll] = useState(true);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (userRole !== "producer" && userRole !== "admin") {
      navigate("/");
      return;
    }
    fetchData();
  }, [user, userRole]);

  const fetchData = async () => {
    try {
      // Fetch UTM links
      const { data: linksData, error: linksError } = await supabase
        .from("utm_links")
        .select("*")
        .order("created_at", { ascending: false });

      if (linksError) throw linksError;

      // Fetch link events associations
      const linkIds = linksData?.map(l => l.id) || [];
      if (linkIds.length > 0) {
        const { data: linkEventsData } = await supabase
          .from("utm_link_events")
          .select("utm_link_id, event_id")
          .in("utm_link_id", linkIds);

        // Get event details for associated events
        const eventIds = [...new Set(linkEventsData?.map(le => le.event_id) || [])];
        let eventDetailsMap: Record<string, Event> = {};
        
        if (eventIds.length > 0) {
          const { data: eventsDetails } = await supabase
            .from("events")
            .select("id, title")
            .in("id", eventIds);
          
          eventDetailsMap = (eventsDetails || []).reduce((acc, e) => {
            acc[e.id] = e;
            return acc;
          }, {} as Record<string, Event>);
        }

        // Map events to links
        const linksWithEvents = linksData?.map(link => ({
          ...link,
          events: linkEventsData
            ?.filter(le => le.utm_link_id === link.id)
            .map(le => eventDetailsMap[le.event_id])
            .filter(Boolean) || []
        })) || [];

        setUtmLinks(linksWithEvents);
      } else {
        setUtmLinks(linksData || []);
      }

      // Fetch producer's events for selection
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select("id, title")
        .order("title");

      if (eventsError) throw eventsError;
      setEvents(eventsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateUtmCode = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const resetForm = () => {
    setName("");
    setUtmCode("");
    setAppliesToAll(true);
    setSelectedEvents([]);
    setEditingLink(null);
  };

  const openEditDialog = (link: UtmLink) => {
    setEditingLink(link);
    setName(link.name);
    setUtmCode(link.utm_code);
    setAppliesToAll(link.applies_to_all_events);
    setSelectedEvents(link.events?.map(e => e.id) || []);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Erro",
        description: "Nome é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (!utmCode.trim()) {
      toast({
        title: "Erro",
        description: "Código UTM é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (!appliesToAll && selectedEvents.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos um evento.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingLink) {
        // Update existing link
        const { error: updateError } = await supabase
          .from("utm_links")
          .update({
            name,
            utm_code: utmCode,
            applies_to_all_events: appliesToAll,
          })
          .eq("id", editingLink.id);

        if (updateError) throw updateError;

        // Delete old event associations
        await supabase
          .from("utm_link_events")
          .delete()
          .eq("utm_link_id", editingLink.id);

        // Insert new associations if not applying to all
        if (!appliesToAll && selectedEvents.length > 0) {
          const { error: insertEventsError } = await supabase
            .from("utm_link_events")
            .insert(
              selectedEvents.map(eventId => ({
                utm_link_id: editingLink.id,
                event_id: eventId,
              }))
            );

          if (insertEventsError) throw insertEventsError;
        }

        toast({
          title: "Sucesso",
          description: "Link UTM atualizado com sucesso.",
        });
      } else {
        // Create new link
        const { data: newLink, error: insertError } = await supabase
          .from("utm_links")
          .insert({
            name,
            utm_code: utmCode,
            applies_to_all_events: appliesToAll,
            producer_id: user?.id,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Insert event associations if not applying to all
        if (!appliesToAll && selectedEvents.length > 0) {
          const { error: insertEventsError } = await supabase
            .from("utm_link_events")
            .insert(
              selectedEvents.map(eventId => ({
                utm_link_id: newLink.id,
                event_id: eventId,
              }))
            );

          if (insertEventsError) throw insertEventsError;
        }

        toast({
          title: "Sucesso",
          description: "Link UTM criado com sucesso.",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error saving UTM link:", error);
      toast({
        title: "Erro",
        description: error.message?.includes("duplicate") 
          ? "Este código UTM já existe." 
          : "Erro ao salvar link UTM.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (linkId: string) => {
    if (!confirm("Tem certeza que deseja excluir este link UTM?")) return;

    try {
      const { error } = await supabase
        .from("utm_links")
        .delete()
        .eq("id", linkId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Link UTM excluído com sucesso.",
      });

      fetchData();
    } catch (error) {
      console.error("Error deleting UTM link:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir link UTM.",
        variant: "destructive",
      });
    }
  };

  const copyLink = (utmCode: string) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/eventos?utm=${utmCode}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copiado!",
      description: "O link foi copiado para a área de transferência.",
    });
  };

  const toggleActive = async (link: UtmLink) => {
    try {
      const { error } = await supabase
        .from("utm_links")
        .update({ is_active: !link.is_active })
        .eq("id", link.id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error("Error toggling link status:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status.",
        variant: "destructive",
      });
    }
  };

  // Filter and paginate links
  const filteredLinks = utmLinks.filter(link => {
    const matchesSearch = link.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          link.utm_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || 
                          (filterStatus === "active" && link.is_active) ||
                          (filterStatus === "inactive" && !link.is_active);
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredLinks.length / ITEMS_PER_PAGE);
  const paginatedLinks = filteredLinks.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Links UTM</h1>
          <p className="text-muted-foreground">Gerencie seus links de rastreamento para promotores e influenciadores</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Link
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingLink ? "Editar Link UTM" : "Criar Link UTM"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nome do Link *</Label>
                <Input
                  placeholder="Ex: Influenciador João, Parceria X..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Código UTM *</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ex: joao2024"
                    value={utmCode}
                    onChange={(e) => setUtmCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setUtmCode(generateUtmCode())}
                  >
                    Gerar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Apenas letras minúsculas e números
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Label>Aplicar a todos os eventos</Label>
                <Switch
                  checked={appliesToAll}
                  onCheckedChange={setAppliesToAll}
                />
              </div>

              {!appliesToAll && (
                <div className="space-y-2">
                  <Label>Selecionar Eventos *</Label>
                  <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                    {events.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum evento disponível</p>
                    ) : (
                      events.map((event) => (
                        <div key={event.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={event.id}
                            checked={selectedEvents.includes(event.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedEvents([...selectedEvents, event.id]);
                              } else {
                                setSelectedEvents(selectedEvents.filter(id => id !== event.id));
                              }
                            }}
                          />
                          <label
                            htmlFor={event.id}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {event.title}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>
                  {editingLink ? "Salvar" : "Criar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou código..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={(value) => {
              setFilterStatus(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Links Table */}
      <Card>
        <CardHeader>
          <CardTitle>Seus Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Eventos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLinks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {searchTerm || filterStatus !== "all" 
                        ? "Nenhum link encontrado com os filtros aplicados."
                        : "Nenhum link UTM criado ainda."}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLinks.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell className="font-medium">{link.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="bg-muted px-2 py-1 rounded text-sm">
                            {link.utm_code}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => copyLink(link.utm_code)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {link.applies_to_all_events ? (
                          <Badge variant="secondary">Todos os eventos</Badge>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {link.events?.slice(0, 2).map((event) => (
                              <Badge key={event.id} variant="outline" className="text-xs">
                                {event.title.length > 20 ? event.title.substring(0, 20) + "..." : event.title}
                              </Badge>
                            ))}
                            {(link.events?.length || 0) > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{(link.events?.length || 0) - 2}
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={link.is_active}
                          onCheckedChange={() => toggleActive(link)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/utm-analytics/${link.id}`)}
                            title="Ver Analytics"
                          >
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(link)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(link.id)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={() => setCurrentPage(page)}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UtmLinks;
