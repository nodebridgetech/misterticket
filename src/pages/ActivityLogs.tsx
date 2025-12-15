import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Phone, Calendar, User, FileText, Download, CalendarIcon } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface ActivityLog {
  id: string;
  created_at: string;
  user_id: string;
  user_name: string | null;
  user_phone: string | null;
  action_type: "create" | "update" | "delete";
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  details: Record<string, any> | null;
}

const ActivityLogs = () => {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("events");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const itemsPerPage = 15;

  useEffect(() => {
    if (!user || userRole !== "admin") {
      navigate("/");
    }
  }, [user, userRole, navigate]);

  useEffect(() => {
    if (user && userRole === "admin") {
      fetchLogs();
    }
  }, [user, userRole, activeTab]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const entityTypes = activeTab === "events" 
        ? ["event", "ticket", "category"] 
        : ["user", "producer"];

      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .in("entity_type", entityTypes)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      setLogs((data as ActivityLog[]) || []);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "create":
        return <Badge className="bg-green-500 hover:bg-green-600">Criação</Badge>;
      case "update":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">Edição</Badge>;
      case "delete":
        return <Badge className="bg-red-500 hover:bg-red-600">Exclusão</Badge>;
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  const getEntityTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      event: "Evento",
      ticket: "Ingresso",
      category: "Categoria",
      user: "Usuário",
      producer: "Produtor",
      fee_config: "Taxa",
    };
    return labels[type] || type;
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "create":
        return "Criação";
      case "update":
        return "Edição";
      case "delete":
        return "Exclusão";
      default:
        return action;
    }
  };

  const filteredLogs = logs.filter((log) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      log.user_name?.toLowerCase().includes(searchLower) ||
      log.entity_name?.toLowerCase().includes(searchLower) ||
      log.user_phone?.includes(searchTerm);

    const logDate = new Date(log.created_at);
    const startOfDay = startDate ? new Date(startDate) : null;
    if (startOfDay) startOfDay.setHours(0, 0, 0, 0);
    const matchesStartDate = !startOfDay || logDate >= startOfDay;
    const endOfDay = endDate ? new Date(endDate) : null;
    if (endOfDay) endOfDay.setHours(23, 59, 59, 999);
    const matchesEndDate = !endOfDay || logDate <= endOfDay;

    const matchesAction = actionFilter === "all" || log.action_type === actionFilter;

    return matchesSearch && matchesStartDate && matchesEndDate && matchesAction;
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentLogs = filteredLogs.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab, startDate, endDate, actionFilter]);

  const clearDateFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setActionFilter("all");
  };

  const exportToCSV = () => {
    if (filteredLogs.length === 0) {
      toast({
        title: "Nenhum log para exportar",
        description: "Não há logs com os filtros atuais para exportar.",
        variant: "destructive",
      });
      return;
    }

    const headers = ["Data/Hora", "Ação", "Tipo", "Usuário", "Telefone", "Entidade"];
    const rows = filteredLogs.map((log) => [
      format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      getActionLabel(log.action_type),
      getEntityTypeLabel(log.entity_type),
      log.user_name || "Desconhecido",
      log.user_phone || "-",
      log.entity_name || "-",
    ]);

    const csvContent = [
      headers.join(";"),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(";")),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `logs_${activeTab}_${format(new Date(), "yyyy-MM-dd_HH-mm")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Exportação concluída",
      description: `${filteredLogs.length} registros exportados com sucesso.`,
    });
  };

  if (!user || userRole !== "admin") {
    return null;
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Logs de Atividades
              </CardTitle>
              <CardDescription>
                Histórico de todas as ações realizadas no sistema
              </CardDescription>
            </div>
            <Button onClick={exportToCSV} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="events">Eventos</TabsTrigger>
              <TabsTrigger value="users">Usuários</TabsTrigger>
            </TabsList>

            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <Input
                placeholder="Buscar por nome do usuário, telefone ou entidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
              
              <div className="flex flex-wrap gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal min-w-[140px]",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yyyy") : "Data início"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal min-w-[140px]",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM/yyyy") : "Data fim"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>

                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Tipo de ação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas ações</SelectItem>
                    <SelectItem value="create">Criação</SelectItem>
                    <SelectItem value="update">Edição</SelectItem>
                    <SelectItem value="delete">Exclusão</SelectItem>
                  </SelectContent>
                </Select>

                {(startDate || endDate || actionFilter !== "all") && (
                  <Button variant="ghost" onClick={clearDateFilters} size="sm">
                    Limpar filtros
                  </Button>
                )}
              </div>
            </div>

            <div className="text-sm text-muted-foreground mb-2">
              {filteredLogs.length} registro(s) encontrado(s)
            </div>

            <TabsContent value="events">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : currentLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhum log de eventos encontrado
                </div>
              ) : (
                <LogsTable logs={currentLogs} getActionBadge={getActionBadge} getEntityTypeLabel={getEntityTypeLabel} />
              )}
            </TabsContent>

            <TabsContent value="users">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : currentLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhum log de usuários encontrado
                </div>
              ) : (
                <LogsTable logs={currentLogs} getActionBadge={getActionBadge} getEntityTypeLabel={getEntityTypeLabel} />
              )}
            </TabsContent>
          </Tabs>

          {totalPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

interface LogsTableProps {
  logs: ActivityLog[];
  getActionBadge: (action: string) => JSX.Element;
  getEntityTypeLabel: (type: string) => string;
}

const LogsTable = ({ logs, getActionBadge, getEntityTypeLabel }: LogsTableProps) => {
  return (
    <>
      {/* Mobile View */}
      <div className="md:hidden space-y-3">
        {logs.map((log) => (
          <Card key={log.id} className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                {getActionBadge(log.action_type)}
                <Badge variant="outline">{getEntityTypeLabel(log.entity_type)}</Badge>
              </div>
              <div className="text-sm">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </div>
              </div>
              <div className="text-sm">
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">{log.user_name || "Usuário desconhecido"}</span>
                </div>
                {log.user_phone && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {log.user_phone}
                  </div>
                )}
              </div>
              {log.entity_name && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Entidade:</span> {log.entity_name}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Desktop View */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Entidade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </div>
                </TableCell>
                <TableCell>{getActionBadge(log.action_type)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{getEntityTypeLabel(log.entity_type)}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {log.user_name || "Desconhecido"}
                  </div>
                </TableCell>
                <TableCell>
                  {log.user_phone ? (
                    <div className="flex items-center gap-1">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {log.user_phone}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="max-w-[200px] truncate" title={log.entity_name || ""}>
                  {log.entity_name || "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
};

export default ActivityLogs;
