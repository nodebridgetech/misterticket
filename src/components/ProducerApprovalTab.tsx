import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, UserCheck, Mail, Calendar } from "lucide-react";
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

interface ProducerApprovalTabProps {
  producerRequests: any[];
  onRefresh: () => void;
}

export const ProducerApprovalTab = ({ producerRequests, onRefresh }: ProducerApprovalTabProps) => {
  const { toast } = useToast();
  const [processing, setProcessing] = useState<string | null>(null);
  
  // Active producers state
  const [activeProducers, setActiveProducers] = useState<any[]>([]);
  const [loadingActive, setLoadingActive] = useState(true);
  
  // Pagination, filter and sort states for active producers
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<string>("name-asc");
  const itemsPerPage = 10;

  // Fetch active producers
  useEffect(() => {
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
      const { error } = await supabase
        .from("user_roles")
        .update({
          is_approved: approve,
          approved_at: approve ? new Date().toISOString() : null,
        })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: approve ? "Produtor aprovado!" : "Solicitação rejeitada",
        description: approve
          ? "O produtor agora pode criar eventos."
          : "A solicitação foi rejeitada.",
      });

      onRefresh();
      fetchActiveProducers(); // Refresh active producers list
    } catch (error) {
      console.error("Error processing request:", error);
      toast({
        title: "Erro",
        description: "Não foi possível processar a solicitação.",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
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
                        onClick={() => handleApproval(request.id, false)}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Label>Ordenar por:</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[200px]">
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Eventos Criados</TableHead>
                    <TableHead>Data de Aprovação</TableHead>
                    <TableHead>Status</TableHead>
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
  );
};
