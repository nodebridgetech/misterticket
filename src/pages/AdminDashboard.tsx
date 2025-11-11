import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryManager } from "@/components/CategoryManager";
import { ProducerApprovalTab } from "@/components/ProducerApprovalTab";
import { EventManagementTab } from "@/components/EventManagementTab";
import { FeeConfigTab } from "@/components/FeeConfigTab";
import { Users, CalendarDays, DollarSign, TrendingUp, BarChart3, Check, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";

const AdminDashboard = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [salesData, setSalesData] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [producerRequests, setProducerRequests] = useState<any[]>([]);
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
      const { data: sales } = await supabase
        .from("sales")
        .select(`
          *,
          events:event_id (
            category
          )
        `);

      const { data: eventsData } = await supabase
        .from("events")
        .select("*");

      const { data: requests, error: requestsError } = await supabase
        .from("user_roles")
        .select("*")
        .eq("role", "producer")
        .eq("is_approved", false);

      if (requestsError) {
        console.error("Error fetching requests:", requestsError);
      }

      // Fetch profiles separately for pending requests
      let requestsWithProfiles = [];
      if (requests && requests.length > 0) {
        const userIds = requests.map(r => r.user_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);

        console.log("Requests:", requests);
        console.log("Profiles Data:", profilesData);
        console.log("Profiles Error:", profilesError);

        requestsWithProfiles = requests.map(request => {
          const profile = profilesData?.find(p => p.user_id === request.user_id);
          console.log("Mapping request:", request.user_id, "Found profile:", profile);
          return {
            ...request,
            profiles: profile || null
          };
        });

        console.log("Final requests with profiles:", requestsWithProfiles);
      }

      setSalesData(sales || []);
      setEvents(eventsData || []);
      setProducerRequests(requestsWithProfiles);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoadingData(false);
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

  const totalSales = salesData.reduce((sum, sale) => sum + Number(sale.total_price || 0), 0);
  const totalPlatformRevenue = salesData.reduce((sum, sale) => sum + Number(sale.platform_fee || 0), 0);
  const totalTicketsSold = salesData.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);

  const eventsByCategory = events.reduce((acc, event) => {
    const category = event.category || "Outros";
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categoryData = Object.entries(eventsByCategory).map(([name, value]) => ({
    name,
    value,
  }));

  const salesByCategory = salesData.reduce((acc, sale: any) => {
    const category = sale.events?.category || "Outros";
    acc[category] = (acc[category] || 0) + Number(sale.total_price || 0);
    return acc;
  }, {} as Record<string, number>);

  const categorySalesData = Object.entries(salesByCategory).map(([name, value]) => ({
    name,
    vendas: value,
  }));

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

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
      title: "Ingressos Vendidos",
      value: totalTicketsSold.toString(),
      icon: TrendingUp,
      description: "total de vendas",
    },
    {
      title: "Receita da Plataforma",
      value: `R$ ${totalPlatformRevenue.toFixed(2)}`,
      icon: DollarSign,
      description: "taxas arrecadadas",
    },
  ];

  return (
    <main className="container mx-auto px-4 py-8">
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

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="producers">
            Produtores
            {producerRequests.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {producerRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="events">Eventos</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="fees">Taxas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Eventos por Categoria
                </CardTitle>
                <CardDescription>
                  Distribuição de eventos cadastrados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {categoryData.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Nenhum dado disponível
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="hsl(var(--primary))"
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Vendas por Categoria
                </CardTitle>
                <CardDescription>
                  Receita gerada por tipo de evento
                </CardDescription>
              </CardHeader>
              <CardContent>
                {categorySalesData.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Nenhuma venda registrada
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={categorySalesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip />
                      <Bar dataKey="vendas" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="producers">
          <ProducerApprovalTab 
            producerRequests={producerRequests}
            onRefresh={fetchData}
          />
        </TabsContent>

        <TabsContent value="events">
          <EventManagementTab 
            events={events}
            onRefresh={fetchData}
          />
        </TabsContent>

        <TabsContent value="categories">
          <CategoryManager />
        </TabsContent>

        <TabsContent value="fees">
          <FeeConfigTab />
        </TabsContent>
      </Tabs>
    </main>
  );
};

export default AdminDashboard;
