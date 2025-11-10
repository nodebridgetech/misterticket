import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, CalendarDays, DollarSign, Settings, CheckCircle, XCircle, Clock, Trash2 } from "lucide-react";

interface ProducerRequest {
  id: string;
  user_id: string;
  role: string;
  requested_at: string;
  is_approved: boolean;
  profiles: {
    full_name: string;
  };
}

interface Event {
  id: string;
  title: string;
  category: string;
  event_date: string;
  status: string;
  is_published: boolean;
  producer_id: string;
  profiles: {
    full_name: string;
  };
}

interface FeeConfig {
  id: string;
  platform_fee_percentage: number;
  payment_gateway_fee_percentage: number;
  min_withdrawal_amount: number;
}

const AdminDashboard = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [producerRequests, setProducerRequests] = useState<ProducerRequest[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [feeConfig, setFeeConfig] = useState<FeeConfig | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && (!user || userRole !== "admin")) {
      navigate("/");
    }
  }, [user, userRole, loading, navigate]);

  useEffect(() => {
    if (userRole === "admin") {
      fetchData();
    }
  }, [userRole]);

  const fetchData = async () => {
    setLoadingData(true);
    try {
      // Fetch pending producer requests
      const { data: requests } = await supabase
        .from("user_roles")
        .select(`
          id,
          user_id,
          role,
          requested_at,
          is_approved,
          profiles:user_id (
            full_name
          )
        `)
        .eq("role", "producer")
        .eq("is_approved", false)
        .order("requested_at", { ascending: false });

      if (requests) {
        setProducerRequests(requests as any);
      }

      // Fetch all events
      const { data: eventsData } = await supabase
        .from("events")
        .select(`
          id,
          title,
          category,
          event_date,
          status,
          is_published,
          producer_id,
          profiles:producer_id (
            full_name
          )
        `)
        .order("created_at", { ascending: false });

      if (eventsData) {
        setEvents(eventsData as any);
      }

      // Fetch fee configuration
      const { data: feeData } = await supabase
        .from("fee_config")
        .select("*")
        .eq("is_active", true)
        .single();

      if (feeData) {
        setFeeConfig(feeData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleApproveProducer = async (requestId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ 
          is_approved: true, 
          approved_at: new Date().toISOString(),
          approved_by: user?.id 
        })
        .eq("id", requestId);

      if (error) throw error;

      toast.success("Produtor aprovado com sucesso!");
      fetchData();
    } catch (error) {
      console.error("Error approving producer:", error);
      toast.error("Erro ao aprovar produtor");
    }
  };

  const handleRejectProducer = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("id", requestId);

      if (error) throw error;

      toast.success("Solicitação rejeitada");
      fetchData();
    } catch (error) {
      console.error("Error rejecting producer:", error);
      toast.error("Erro ao rejeitar solicitação");
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm("Tem certeza que deseja deletar este evento?")) return;

    try {
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", eventId);

      if (error) throw error;

      toast.success("Evento deletado com sucesso!");
      fetchData();
    } catch (error) {
      console.error("Error deleting event:", error);
      toast.error("Erro ao deletar evento");
    }
  };

  const handleUpdateFees = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!feeConfig) return;

    try {
      const { error } = await supabase
        .from("fee_config")
        .update({
          platform_fee_percentage: feeConfig.platform_fee_percentage,
          payment_gateway_fee_percentage: feeConfig.payment_gateway_fee_percentage,
          min_withdrawal_amount: feeConfig.min_withdrawal_amount,
        })
        .eq("id", feeConfig.id);

      if (error) throw error;

      toast.success("Configuração de taxas atualizada!");
    } catch (error) {
      console.error("Error updating fees:", error);
      toast.error("Erro ao atualizar taxas");
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  if (userRole !== "admin") {
    return null;
  }

  const stats = [
    {
      title: "Produtores Pendentes",
      value: producerRequests.length.toString(),
      icon: Users,
      description: "aguardando aprovação",
    },
    {
      title: "Eventos Publicados",
      value: events.filter(e => e.is_published).length.toString(),
      icon: CalendarDays,
      description: "eventos ativos",
    },
    {
      title: "Total de Eventos",
      value: events.length.toString(),
      icon: CalendarDays,
      description: "registrados no sistema",
    },
    {
      title: "Taxa da Plataforma",
      value: `${feeConfig?.platform_fee_percentage || 0}%`,
      icon: DollarSign,
      description: "configuração atual",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Painel Administrativo</h1>
          <p className="text-muted-foreground">
            Gerencie produtores, eventos e configurações da plataforma
          </p>
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

        <Tabs defaultValue="producers" className="space-y-6">
          <TabsList>
            <TabsTrigger value="producers">Produtores</TabsTrigger>
            <TabsTrigger value="events">Eventos</TabsTrigger>
            <TabsTrigger value="fees">Configuração de Taxas</TabsTrigger>
          </TabsList>

          <TabsContent value="producers">
            <Card>
              <CardHeader>
                <CardTitle>Solicitações de Produtor</CardTitle>
                <CardDescription>
                  Aprove ou rejeite solicitações para se tornar produtor
                </CardDescription>
              </CardHeader>
              <CardContent>
                {producerRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Nenhuma solicitação pendente
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Data da Solicitação</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {producerRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">
                            {request.profiles?.full_name || "N/A"}
                          </TableCell>
                          <TableCell>
                            {new Date(request.requested_at).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              <Clock className="h-3 w-3" />
                              Pendente
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleApproveProducer(request.id, request.user_id)}
                                className="gap-1"
                              >
                                <CheckCircle className="h-4 w-4" />
                                Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRejectProducer(request.id)}
                                className="gap-1"
                              >
                                <XCircle className="h-4 w-4" />
                                Rejeitar
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
          </TabsContent>

          <TabsContent value="events">
            <Card>
              <CardHeader>
                <CardTitle>Gerenciamento de Eventos</CardTitle>
                <CardDescription>
                  Visualize e gerencie todos os eventos da plataforma
                </CardDescription>
              </CardHeader>
              <CardContent>
                {events.length === 0 ? (
                  <div className="text-center py-12">
                    <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Nenhum evento cadastrado
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Produtor</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Publicado</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="font-medium">
                            {event.title}
                          </TableCell>
                          <TableCell>
                            {event.profiles?.full_name || "N/A"}
                          </TableCell>
                          <TableCell>{event.category}</TableCell>
                          <TableCell>
                            {new Date(event.event_date).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <Badge variant={event.is_published ? "default" : "secondary"}>
                              {event.is_published ? "Sim" : "Não"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteEvent(event.id)}
                              className="gap-1"
                            >
                              <Trash2 className="h-4 w-4" />
                              Deletar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fees">
            <Card>
              <CardHeader>
                <CardTitle>Configuração de Taxas</CardTitle>
                <CardDescription>
                  Configure as taxas da plataforma e do gateway de pagamento
                </CardDescription>
              </CardHeader>
              <CardContent>
                {feeConfig ? (
                  <form onSubmit={handleUpdateFees} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="platform_fee">Taxa da Plataforma (%)</Label>
                      <Input
                        id="platform_fee"
                        type="number"
                        step="0.01"
                        value={feeConfig.platform_fee_percentage}
                        onChange={(e) =>
                          setFeeConfig({
                            ...feeConfig,
                            platform_fee_percentage: parseFloat(e.target.value),
                          })
                        }
                        required
                      />
                      <p className="text-sm text-muted-foreground">
                        Percentual cobrado pela plataforma
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gateway_fee">Taxa do Gateway de Pagamento (%)</Label>
                      <Input
                        id="gateway_fee"
                        type="number"
                        step="0.01"
                        value={feeConfig.payment_gateway_fee_percentage}
                        onChange={(e) =>
                          setFeeConfig({
                            ...feeConfig,
                            payment_gateway_fee_percentage: parseFloat(e.target.value),
                          })
                        }
                        required
                      />
                      <p className="text-sm text-muted-foreground">
                        Percentual cobrado pelo gateway de pagamento
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="min_withdrawal">Valor Mínimo de Saque (R$)</Label>
                      <Input
                        id="min_withdrawal"
                        type="number"
                        step="0.01"
                        value={feeConfig.min_withdrawal_amount}
                        onChange={(e) =>
                          setFeeConfig({
                            ...feeConfig,
                            min_withdrawal_amount: parseFloat(e.target.value),
                          })
                        }
                        required
                      />
                      <p className="text-sm text-muted-foreground">
                        Valor mínimo para solicitação de saque
                      </p>
                    </div>

                    <Button type="submit" className="gap-2">
                      <Settings className="h-4 w-4" />
                      Salvar Configurações
                    </Button>
                  </form>
                ) : (
                  <div className="text-center py-12">
                    <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Nenhuma configuração encontrada
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
};

export default AdminDashboard;
