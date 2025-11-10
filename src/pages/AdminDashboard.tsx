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
import { Users, CalendarDays, DollarSign, Settings, CheckCircle, XCircle, Clock, Trash2, TrendingUp, BarChart3, FolderKanban, Plus, Edit, X } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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

interface Category {
  id: string;
  name: string;
  description: string;
}

const AdminDashboard = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [producerRequests, setProducerRequests] = useState<ProducerRequest[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [feeConfig, setFeeConfig] = useState<FeeConfig | null>(null);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");

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
      // Fetch pending producer requests with proper join
      const { data: requests, error: requestsError } = await supabase
        .from("user_roles")
        .select("id, user_id, role, requested_at, is_approved")
        .eq("role", "producer")
        .eq("is_approved", false)
        .order("requested_at", { ascending: false });

      if (requestsError) {
        console.error("Error fetching producer requests:", requestsError);
      }

      if (requests) {
        // Fetch profiles separately
        const userIds = requests.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        // Merge data
        const requestsWithProfiles = requests.map(request => ({
          ...request,
          profiles: profiles?.find(p => p.user_id === request.user_id) || { full_name: "N/A" }
        }));

        setProducerRequests(requestsWithProfiles as any);
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

      // Fetch sales data for charts
      const { data: sales } = await supabase
        .from("sales")
        .select(`
          *,
          events:event_id (
            category
          )
        `);

      if (sales) {
        setSalesData(sales);
      }

      // Fetch categories
      const { data: categoriesData } = await supabase
        .from("categories")
        .select("*")
        .order("name");

      if (categoriesData) {
        setCategories(categoriesData);
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

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) {
      toast.error("Nome da categoria é obrigatório");
      return;
    }

    try {
      if (editingCategory) {
        // Update existing category
        const { error } = await supabase
          .from("categories")
          .update({ name: categoryName, description: categoryDescription })
          .eq("id", editingCategory.id);

        if (error) throw error;
        toast.success("Categoria atualizada!");
      } else {
        // Create new category
        const { error } = await supabase
          .from("categories")
          .insert({ name: categoryName, description: categoryDescription });

        if (error) throw error;
        toast.success("Categoria criada!");
      }

      setCategoryName("");
      setCategoryDescription("");
      setEditingCategory(null);
      setShowCategoryForm(false);
      fetchData();
    } catch (error) {
      console.error("Error saving category:", error);
      toast.error("Erro ao salvar categoria");
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryDescription(category.description || "");
    setShowCategoryForm(true);
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Tem certeza que deseja deletar esta categoria?")) return;

    try {
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Categoria deletada!");
      fetchData();
    } catch (error) {
      console.error("Error deleting category:", error);
      toast.error("Erro ao deletar categoria");
    }
  };

  const handleCancelCategoryForm = () => {
    setCategoryName("");
    setCategoryDescription("");
    setEditingCategory(null);
    setShowCategoryForm(false);
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

  // Calculate metrics
  const totalSales = salesData.reduce((sum, sale) => sum + Number(sale.total_price || 0), 0);
  const totalPlatformRevenue = salesData.reduce((sum, sale) => sum + Number(sale.platform_fee || 0), 0);
  const totalTicketsSold = salesData.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);

  // Events by category
  const eventsByCategory = events.reduce((acc, event) => {
    const category = event.category || "Outros";
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categoryData = Object.entries(eventsByCategory).map(([name, value]) => ({
    name,
    value,
  }));

  // Sales by category
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

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="producers">Produtores</TabsTrigger>
            <TabsTrigger value="events">Eventos</TabsTrigger>
            <TabsTrigger value="categories">Categorias</TabsTrigger>
            <TabsTrigger value="fees">Configuração de Taxas</TabsTrigger>
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
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "var(--radius)",
                          }}
                          formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Vendas"]}
                        />
                        <Legend />
                        <Bar dataKey="vendas" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Resumo Financeiro</CardTitle>
                <CardDescription>
                  Visão geral das transações e taxas da plataforma
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Total em Vendas</p>
                    <p className="text-2xl font-bold">R$ {totalSales.toFixed(2)}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Receita da Plataforma</p>
                    <p className="text-2xl font-bold text-primary">R$ {totalPlatformRevenue.toFixed(2)}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Taxa Atual</p>
                    <p className="text-2xl font-bold">{feeConfig?.platform_fee_percentage || 0}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

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

          <TabsContent value="categories">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Configurações de Categoria</CardTitle>
                    <CardDescription>
                      Gerencie as categorias de eventos da plataforma
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => setShowCategoryForm(!showCategoryForm)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Nova Categoria
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {showCategoryForm && (
                  <Card className="border-2 border-primary">
                    <CardContent className="pt-6 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="categoryName">Nome da Categoria *</Label>
                        <Input
                          id="categoryName"
                          value={categoryName}
                          onChange={(e) => setCategoryName(e.target.value)}
                          placeholder="Ex: Shows, Festas, Teatro"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="categoryDescription">Descrição</Label>
                        <Input
                          id="categoryDescription"
                          value={categoryDescription}
                          onChange={(e) => setCategoryDescription(e.target.value)}
                          placeholder="Descrição opcional"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={handleSaveCategory}>
                          {editingCategory ? "Atualizar" : "Criar"}
                        </Button>
                        <Button variant="outline" onClick={handleCancelCategoryForm}>
                          Cancelar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {categories.length === 0 ? (
                  <div className="text-center py-12">
                    <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Nenhuma categoria cadastrada
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {categories.map((category) => (
                      <div
                        key={category.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <h3 className="font-semibold">{category.name}</h3>
                          {category.description && (
                            <p className="text-sm text-muted-foreground">
                              {category.description}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditCategory(category)}
                            className="gap-1"
                          >
                            <Edit className="h-4 w-4" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteCategory(category.id)}
                            className="gap-1"
                          >
                            <Trash2 className="h-4 w-4" />
                            Deletar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
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
