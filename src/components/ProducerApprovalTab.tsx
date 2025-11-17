import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, UserCheck, Mail, Calendar, UserX, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
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
import { Label } from "@/components/ui/label";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

export const ProducerApprovalTab = () => {
  const { toast } = useToast();
  const [processing, setProcessing] = useState<string | null>(null);
  const [producerRequests, setProducerRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Active producers state
  const [activeProducers, setActiveProducers] = useState<any[]>([]);
  const [loadingActive, setLoadingActive] = useState(true);
  
  // Pagination, filter and sort states for active producers
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<string>("name-asc");
  const itemsPerPage = 10;

  // Confirmation dialogs state
  const [deactivateDialog, setDeactivateDialog] = useState<{ open: boolean; producerId: string | null }>({
    open: false,
    producerId: null,
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; producerId: string | null }>({
    open: false,
    producerId: null,
  });

  // Fetch producer requests
  const fetchProducerRequests = async () => {
    setLoading(true);
    try {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*")
        .eq("role", "producer")
        .eq("is_approved", false)
        .order("requested_at", { ascending: false });

      if (rolesError) throw rolesError;

      if (roles && roles.length > 0) {
        const userIds = roles.map(r => r.user_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, document, phone")
          .in("user_id", userIds);

        if (profilesError) throw profilesError;

        const requestsWithProfiles = roles.map(role => ({
          ...role,
          profiles: profilesData?.find(p => p.user_id === role.user_id)
        }));

        setProducerRequests(requestsWithProfiles);
      } else {
        setProducerRequests([]);
      }
    } catch (error) {
      console.error("Error fetching producer requests:", error);
      toast({
        title: "Erro ao carregar solicitações",
        description: "Não foi possível carregar as solicitações de produtores.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch active producers
  useEffect(() => {
    fetchProducerRequests();
    fetchActiveProducers();
  }, []);

  const fetchActiveProducers = async () => {
    setLoadingActive(true);
    try {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*")
        .eq("role", "producer")
        .eq("is_approved", true);

      if (rolesError) throw rolesError;

      if (roles && roles.length > 0) {
        const userIds = roles.map(r => r.user_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, full_name, email, created_at")
          .in("user_id", userIds);

        if (profilesError) throw profilesError;

        // Count events for each producer
        const { data: eventsData } = await supabase
          .from("events")
          .select("producer_id");

        const producersWithData = roles.map(role => {
          const profile = profilesData?.find(p => p.user_id === role.user_id);
          const eventCount = eventsData?.filter(e => e.producer_id === role.user_id).length || 0;
          
          return {
            ...role,
            profile,
            eventCount
          };
        });

        setActiveProducers(producersWithData);
      }
    } catch (error) {
      console.error("Error fetching active producers:", error);
    } finally {
      setLoadingActive(false);
    }
  };

  const handleApproval = async (requestId: string, approve: boolean) => {
    setProcessing(requestId);
    try {
      console.log("Processing request:", requestId, "approve:", approve);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      if (approve) {
        // Get the producer request details for email
        const request = producerRequests.find(r => r.id === requestId);
        
        // Approve the request
        const { error } = await supabase
          .from("user_roles")
          .update({
            is_approved: true,
            approved_at: new Date().toISOString(),
            approved_by: user.id,
          })
          .eq("id", requestId);

        if (error) {
          console.error("Supabase error on approve:", error);
          throw error;
        }

        // Send approval notification email
        if (request?.profiles?.email && request?.profiles?.full_name) {
          try {
            await supabase.functions.invoke('send-producer-approval', {
              body: {
                email: request.profiles.email,
                userName: request.profiles.full_name
              }
            });
            console.log("Producer approval email sent");
          } catch (emailError) {
            console.error("Error sending approval email:", emailError);
            // Don't fail the whole operation if email fails
          }
        }
      } else {
        // Delete the request instead of updating
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("id", requestId);

        if (error) {
          console.error("Supabase error on reject:", error);
          throw error;
        }
      }

      toast({
        title: approve ? "Produtor aprovado!" : "Solicitação rejeitada",
        description: approve
          ? "O produtor agora pode criar eventos."
          : "A solicitação foi rejeitada e removida.",
      });

      await fetchProducerRequests();
      await fetchActiveProducers();
    } catch (error) {
      console.error("Error processing request:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível processar a solicitação.",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleDeactivateProducer = async (producerId: string) => {
    setProcessing(producerId);
    try {
      // Update user_role to set is_approved to false
      const { error } = await supabase
        .from("user_roles")
        .update({ is_approved: false })
        .eq("user_id", producerId)
        .eq("role", "producer");

      if (error) throw error;

      toast({
        title: "Produtor inativado",
        description: "O produtor foi inativado e voltou a ser visitante.",
      });

      fetchActiveProducers();
      fetchProducerRequests(); // May show in pending if they want to reapply
    } catch (error) {
      console.error("Error deactivating producer:", error);
      toast({
        title: "Erro ao inativar",
        description: "Não foi possível inativar o produtor.",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
      setDeactivateDialog({ open: false, producerId: null });
    }
  };

  const handleDeleteProducer = async (producerId: string) => {
    setProcessing(producerId);
    try {
      // Delete the producer role from user_roles
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", producerId)
        .eq("role", "producer");

      if (error) throw error;

      toast({
        title: "Produtor excluído",
        description: "O papel de produtor foi removido do usuário.",
      });

      fetchActiveProducers();
    } catch (error) {
      console.error("Error deleting producer:", error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o produtor.",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
      setDeleteDialog({ open: false, producerId: null });
    }
  };

  // Filter and sort active producers
  const filteredProducers = activeProducers
    .filter((producer) => {
      const matchesSearch = 
        producer.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        producer.profile?.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return (a.profile?.full_name || "").localeCompare(b.profile?.full_name || "");
        case "name-desc":
          return (b.profile?.full_name || "").localeCompare(a.profile?.full_name || "");
        case "events-asc":
          return a.eventCount - b.eventCount;
        case "events-desc":
          return b.eventCount - a.eventCount;
        case "date-asc":
          return new Date(a.approved_at || 0).getTime() - new Date(b.approved_at || 0).getTime();
        case "date-desc":
          return new Date(b.approved_at || 0).getTime() - new Date(a.approved_at || 0).getTime();
        default:
          return 0;
      }
    });

  // Pagination for active producers
  const totalPages = Math.ceil(filteredProducers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducers = filteredProducers.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy]);

  return (
    <div className="space-y-6">
      {/* Pending Requests Card */}
      <Card>
        <CardHeader>
          <CardTitle>Solicitações de Produtores</CardTitle>
          <CardDescription>
            Aprove ou rejeite solicitações para se tornar produtor
          </CardDescription>
        </CardHeader>
        <CardContent>
          {producerRequests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma solicitação pendente
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Produtor</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Data da Solicitação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {producerRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {request.profiles?.full_name || "Nome não disponível"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {request.profiles?.email || "Email não disponível"}
                    </TableCell>
                    <TableCell>
                      {format(new Date(request.requested_at), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">Pendente</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleApproval(request.id, true)}
                        disabled={processing === request.id}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          console.log("Rejecting request:", request.id);
                          handleApproval(request.id, false);
                        }}
                        disabled={processing === request.id}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Rejeitar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Active Producers Card */}
      <Card>
        <CardHeader>
          <CardTitle>Produtores Ativos</CardTitle>
          <CardDescription>
            Visualize e gerencie todos os produtores aprovados da plataforma
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters and Search */}
          <div className="flex flex-col gap-4">
            <div className="w-full">
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <Label className="shrink-0">Ordenar por:</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">Nome (A-Z)</SelectItem>
                  <SelectItem value="name-desc">Nome (Z-A)</SelectItem>
                  <SelectItem value="events-asc">Eventos (menos)</SelectItem>
                  <SelectItem value="events-desc">Eventos (mais)</SelectItem>
                  <SelectItem value="date-asc">Aprovação (antiga)</SelectItem>
                  <SelectItem value="date-desc">Aprovação (recente)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            {filteredProducers.length} produtor(es) ativo(s)
          </div>

          {/* Table */}
          {loadingActive ? (
            <div className="text-center py-12 text-muted-foreground">
              Carregando produtores...
            </div>
          ) : currentProducers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum produtor ativo encontrado
            </div>
          ) : (
            <>
              <div className="md:hidden space-y-3">
                {currentProducers.map((producer) => (
                  <Card key={producer.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <UserCheck className="h-4 w-4 text-primary flex-shrink-0" />
                            <h3 className="font-medium text-sm truncate">
                              {producer.profile?.full_name || "Nome não disponível"}
                            </h3>
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                            <Mail className="h-3 w-3 flex-shrink-0" />
                            {producer.profile?.email || "Email não disponível"}
                          </p>
                        </div>
                        <Badge variant="default" className="flex-shrink-0">Ativo</Badge>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Eventos:</span>
                          <Badge variant="secondary" className="text-xs">{producer.eventCount}</Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {producer.approved_at 
                              ? format(new Date(producer.approved_at), "dd/MM/yyyy")
                              : "N/A"
                            }
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => setDeactivateDialog({ open: true, producerId: producer.user_id })}
                          disabled={processing === producer.user_id}
                        >
                          <UserX className="h-3 w-3 mr-1" />
                          Inativar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => setDeleteDialog({ open: true, producerId: producer.user_id })}
                          disabled={processing === producer.user_id}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Excluir
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
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Eventos Criados</TableHead>
                      <TableHead>Data de Aprovação</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentProducers.map((producer) => (
                      <TableRow key={producer.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <UserCheck className="h-4 w-4 text-primary" />
                            {producer.profile?.full_name || "Nome não disponível"}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            {producer.profile?.email || "Email não disponível"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{producer.eventCount} eventos</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4" />
                            {producer.approved_at 
                              ? format(new Date(producer.approved_at), "dd/MM/yyyy")
                              : "Data não disponível"
                            }
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default">Ativo</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                disabled={processing === producer.user_id}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => setDeactivateDialog({ open: true, producerId: producer.user_id })}
                                className="text-orange-600"
                              >
                                <UserX className="h-4 w-4 mr-2" />
                                Inativar Produtor
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteDialog({ open: true, producerId: producer.user_id })}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir Produtor
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={deactivateDialog.open} onOpenChange={(open) => setDeactivateDialog({ open, producerId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inativar Produtor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja inativar este produtor? Ele perderá o acesso ao painel de produtor e voltará a ser visitante. 
              Todos os eventos e vendas serão mantidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deactivateDialog.producerId && handleDeactivateProducer(deactivateDialog.producerId)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Inativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, producerId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Produtor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este produtor? Esta ação removerá o papel de produtor do usuário permanentemente. 
              Os eventos e vendas associados serão mantidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialog.producerId && handleDeleteProducer(deleteDialog.producerId)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
