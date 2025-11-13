import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Users, DollarSign, TrendingUp, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

  const [salesData, setSalesData] = useState<SalesData>({ total_sales: 0, total_revenue: 0, total_tickets_sold: 0 });
  const [eventsSales, setEventsSales] = useState<EventSales[]>([]);
  const [myEvents, setMyEvents] = useState<any[]>([]);

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
        .eq("is_published", true);

      if (data) {
        setMyEvents(data);
      }
    } catch (error) {
      console.error("Error fetching events:", error);
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Dashboard do Produtor</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Acompanhe suas vendas e desempenho em tempo real
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

        <div className="space-y-6">
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
        </div>
      </div>
    </div>
  );
};

export default ProducerDashboard;
