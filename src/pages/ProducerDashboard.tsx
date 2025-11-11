import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Users, DollarSign, TrendingUp, Plus, Trash2, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line } from "recharts";

interface SalesData {
  total_sales: number;
  total_revenue: number;
  total_tickets_sold: number;
}

interface EventSales {
  event_title: string;
  total_sold: number;
  revenue: number;
}

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
  const [salesData, setSalesData] = useState<SalesData>({ total_sales: 0, total_revenue: 0, total_tickets_sold: 0 });
  const [eventsSales, setEventsSales] = useState<EventSales[]>([]);

  useEffect(() => {
    if (user && isProducerApproved) {
      fetchMyEvents();
      fetchSalesData();
      subscribeToSales();
    }
  }, [user, isProducerApproved]);

  const subscribeToSales = () => {
    const channel = supabase
      .channel('sales-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales'
        },
        () => {
          fetchSalesData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchSalesData = async () => {
    try {
      // Get all sales for producer's events
      const { data: sales, error } = await supabase
        .from('sales')
        .select(`
          id,
          quantity,
          producer_amount,
          event_id,
          events!inner (
            title,
            producer_id
          )
        `)
        .eq('events.producer_id', user?.id)
        .eq('payment_status', 'paid');

      if (error) throw error;

      if (sales) {
        // Calculate totals
        const totalSales = sales.length;
        const totalTickets = sales.reduce((sum, sale) => sum + sale.quantity, 0);
        const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.producer_amount), 0);

        setSalesData({
          total_sales: totalSales,
          total_revenue: totalRevenue,
          total_tickets_sold: totalTickets
        });

        // Group by event
        const eventSalesMap = new Map<string, { title: string; sold: number; revenue: number }>();
        
        sales.forEach(sale => {
          const eventId = sale.event_id;
          const eventTitle = sale.events.title;
          
          if (!eventSalesMap.has(eventId)) {
            eventSalesMap.set(eventId, { title: eventTitle, sold: 0, revenue: 0 });
          }
          
          const current = eventSalesMap.get(eventId)!;
          current.sold += sale.quantity;
          current.revenue += Number(sale.producer_amount);
        });

        const eventSalesArray = Array.from(eventSalesMap.values()).map(event => ({
          event_title: event.title,
          total_sold: event.sold,
          revenue: event.revenue
        }));

        setEventsSales(eventSalesArray);
      }
    } catch (error) {
      console.error("Error fetching sales data:", error);
    }
  };

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

  const conversionRate = myEvents.filter(e => e.is_published).length > 0 
    ? ((salesData.total_sales / myEvents.filter(e => e.is_published).length) * 100).toFixed(1)
    : "0";

  const stats = [
    {
      title: "Eventos Ativos",
      value: myEvents.filter(e => e.is_published).length.toString(),
      icon: CalendarDays,
      description: "eventos publicados",
    },
    {
      title: "Ingressos Vendidos",
      value: salesData.total_tickets_sold.toString(),
      icon: Users,
      description: "total de ingressos",
    },
    {
      title: "Receita do Produtor",
      value: `R$ ${salesData.total_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      description: "valor após taxas",
    },
    {
      title: "Vendas por Evento",
      value: conversionRate,
      icon: TrendingUp,
      description: "média de vendas",
    },
  ];

  const chartConfig = {
    revenue: {
      label: "Receita",
      color: "hsl(var(--primary))",
    },
    tickets: {
      label: "Ingressos",
      color: "hsl(var(--secondary))",
    },
  };

  return (
    <>
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Painel do Produtor</h1>
            <p className="text-muted-foreground">
              Gerencie seus eventos e acompanhe suas vendas em tempo real
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

        <Tabs defaultValue="overview" className="mb-8">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="events">Meus Eventos</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Vendas por Evento
                  </CardTitle>
                  <CardDescription>
                    Ingressos vendidos por evento
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {eventsSales.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={eventsSales}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis 
                            dataKey="event_title" 
                            stroke="hsl(var(--foreground))"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis 
                            stroke="hsl(var(--foreground))"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                          />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar 
                            dataKey="total_sold" 
                            fill="var(--color-tickets)" 
                            radius={[8, 8, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  ) : (
                    <div className="text-center py-12">
                      <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Nenhuma venda ainda</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Receita por Evento
                  </CardTitle>
                  <CardDescription>
                    Valor recebido após taxas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {eventsSales.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={eventsSales}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis 
                            dataKey="event_title" 
                            stroke="hsl(var(--foreground))"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis 
                            stroke="hsl(var(--foreground))"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                          />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line 
                            type="monotone" 
                            dataKey="revenue" 
                            stroke="var(--color-revenue)" 
                            strokeWidth={2}
                            dot={{ fill: "var(--color-revenue)", r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  ) : (
                    <div className="text-center py-12">
                      <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Nenhuma receita ainda</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Detalhes de Vendas por Evento</CardTitle>
                <CardDescription>
                  Estatísticas completas de cada evento
                </CardDescription>
              </CardHeader>
              <CardContent>
                {eventsSales.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Evento</TableHead>
                        <TableHead>Ingressos Vendidos</TableHead>
                        <TableHead>Receita do Produtor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eventsSales.map((event, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{event.event_title}</TableCell>
                          <TableCell>{event.total_sold}</TableCell>
                          <TableCell>
                            R$ {event.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Nenhuma venda registrada</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events">
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
                          onClick={() => navigate(`/event/${event.id}`)}
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
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </>
  );
};

export default ProducerDashboard;