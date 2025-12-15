import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  DollarSign, TrendingUp, TrendingDown, Wallet, Receipt, 
  CalendarIcon, ChevronLeft, ChevronRight, Filter, Download,
  CreditCard, Percent, PiggyBank, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";

interface Sale {
  id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  platform_fee: number;
  gateway_fee: number;
  producer_amount: number;
  payment_status: string;
  payment_method: string | null;
  created_at: string;
  event_title: string;
  ticket_name: string;
  buyer_name: string;
}

interface ChartData {
  date: string;
  revenue: number;
  fees: number;
  net: number;
}

interface MonthlyComparison {
  month: string;
  monthLabel: string;
  revenue: number;
  net: number;
  growthRevenue: number | null;
  growthNet: number | null;
}

interface ForecastData {
  month: string;
  actual: number | null;
  forecast: number | null;
}

const ITEMS_PER_PAGE = 15;

const FinancialDashboard = () => {
  const { user, isProducerApproved, loading } = useAuth();
  const navigate = useNavigate();
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  
  // Totals
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalFees, setTotalFees] = useState(0);
  const [netRevenue, setNetRevenue] = useState(0);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [monthlyComparison, setMonthlyComparison] = useState<MonthlyComparison[]>([]);
  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [futureEventsRevenue, setFutureEventsRevenue] = useState(0);
  
  // Filters
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!loading && (!user || !isProducerApproved)) {
      navigate("/minha-conta");
    }
  }, [user, isProducerApproved, loading, navigate]);

  useEffect(() => {
    if (user && isProducerApproved) {
      fetchData();
    }
  }, [user, isProducerApproved]);

  // Apply filters
  useEffect(() => {
    let filtered = [...sales];
    
    if (eventFilter !== "all") {
      filtered = filtered.filter(s => s.event_title === eventFilter);
    }
    
    if (statusFilter !== "all") {
      filtered = filtered.filter(s => s.payment_status === statusFilter);
    }
    
    if (startDate) {
      filtered = filtered.filter(s => new Date(s.created_at) >= startDate);
    }
    
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(s => new Date(s.created_at) <= endOfDay);
    }
    
    setFilteredSales(filtered);
    setCurrentPage(1);
  }, [sales, eventFilter, statusFilter, startDate, endDate]);

  const fetchData = async () => {
    setLoadingData(true);
    try {
      // Fetch all sales for producer's events
      const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .select(`
          id,
          quantity,
          unit_price,
          total_price,
          platform_fee,
          gateway_fee,
          producer_amount,
          payment_status,
          payment_method,
          created_at,
          buyer_id,
          events!inner (
            title,
            producer_id
          ),
          tickets (
            batch_name
          )
        `)
        .eq("events.producer_id", user?.id)
        .order("created_at", { ascending: false });

      if (salesError) throw salesError;

      // Fetch buyer names
      const buyerIds = [...new Set((salesData || []).map(s => s.buyer_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", buyerIds);

      const salesWithDetails = (salesData || []).map(sale => {
        const buyerProfile = profiles?.find(p => p.user_id === sale.buyer_id);
        return {
          id: sale.id,
          quantity: sale.quantity,
          unit_price: Number(sale.unit_price),
          total_price: Number(sale.total_price),
          platform_fee: Number(sale.platform_fee),
          gateway_fee: Number(sale.gateway_fee),
          producer_amount: Number(sale.producer_amount),
          payment_status: sale.payment_status,
          payment_method: sale.payment_method,
          created_at: sale.created_at,
          event_title: (sale.events as any)?.title || "Evento",
          ticket_name: (sale.tickets as any)?.batch_name || "Ingresso",
          buyer_name: buyerProfile?.full_name || "Cliente",
        };
      });

      setSales(salesWithDetails);

      // Get unique events for filter
      const uniqueEvents = [...new Set(salesWithDetails.map(s => s.event_title))].map(title => ({
        id: title,
        title
      }));
      setEvents(uniqueEvents);

      // Calculate totals (only for paid sales)
      const paidSales = salesWithDetails.filter(s => s.payment_status === "paid");
      const revenue = paidSales.reduce((sum, s) => sum + s.total_price, 0);
      const fees = paidSales.reduce((sum, s) => sum + s.platform_fee + s.gateway_fee, 0);
      const net = paidSales.reduce((sum, s) => sum + s.producer_amount, 0);

      setTotalRevenue(revenue);
      setTotalFees(fees);
      setNetRevenue(net);

      // Fetch withdrawn amount
      const { data: withdrawals } = await supabase
        .from("withdrawal_requests")
        .select("amount, status")
        .eq("producer_id", user?.id);

      const withdrawn = (withdrawals || [])
        .filter(w => w.status === "completed")
        .reduce((sum, w) => sum + Number(w.amount), 0);

      const pending = (withdrawals || [])
        .filter(w => ["pending", "approved", "processing"].includes(w.status))
        .reduce((sum, w) => sum + Number(w.amount), 0);

      setAvailableBalance(net - withdrawn - pending);

      // Generate chart data (last 30 days)
      generateChartData(paidSales);
      
      // Generate monthly comparison data (last 6 months)
      generateMonthlyComparison(paidSales);
      
      // Generate forecast data
      await generateForecast(paidSales);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados financeiros");
    } finally {
      setLoadingData(false);
    }
  };

  const generateChartData = (paidSales: Sale[]) => {
    const days = 30;
    const data: ChartData[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const daySales = paidSales.filter(s => {
        const saleDate = new Date(s.created_at);
        return saleDate >= date && saleDate < nextDate;
      });
      
      data.push({
        date: format(date, "dd/MM"),
        revenue: daySales.reduce((sum, s) => sum + s.total_price, 0),
        fees: daySales.reduce((sum, s) => sum + s.platform_fee + s.gateway_fee, 0),
        net: daySales.reduce((sum, s) => sum + s.producer_amount, 0),
      });
    }
    
    setChartData(data);
  };

  const generateMonthlyComparison = (paidSales: Sale[]) => {
    const months: MonthlyComparison[] = [];
    const now = new Date();
    
    // Last 6 months
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      
      const monthSales = paidSales.filter(s => {
        const saleDate = new Date(s.created_at);
        return saleDate >= monthDate && saleDate <= monthEnd;
      });
      
      const revenue = monthSales.reduce((sum, s) => sum + s.total_price, 0);
      const net = monthSales.reduce((sum, s) => sum + s.producer_amount, 0);
      
      months.push({
        month: format(monthDate, "yyyy-MM"),
        monthLabel: format(monthDate, "MMM/yy", { locale: ptBR }),
        revenue,
        net,
        growthRevenue: null,
        growthNet: null,
      });
    }
    
    // Calculate growth percentages
    for (let i = 1; i < months.length; i++) {
      const prevRevenue = months[i - 1].revenue;
      const prevNet = months[i - 1].net;
      
      if (prevRevenue > 0) {
        months[i].growthRevenue = ((months[i].revenue - prevRevenue) / prevRevenue) * 100;
      }
      if (prevNet > 0) {
        months[i].growthNet = ((months[i].net - prevNet) / prevNet) * 100;
      }
    }
    
    setMonthlyComparison(months);
  };

  const generateForecast = async (paidSales: Sale[]) => {
    const now = new Date();
    const forecastMonths: ForecastData[] = [];
    
    // Last 3 months actuals
    for (let i = 2; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      
      const monthSales = paidSales.filter(s => {
        const saleDate = new Date(s.created_at);
        return saleDate >= monthDate && saleDate <= monthEnd;
      });
      
      const net = monthSales.reduce((sum, s) => sum + s.producer_amount, 0);
      
      forecastMonths.push({
        month: format(monthDate, "MMM/yy", { locale: ptBR }),
        actual: net,
        forecast: null,
      });
    }
    
    // Calculate average monthly revenue for forecasting
    const avgMonthlyNet = forecastMonths.reduce((sum, m) => sum + (m.actual || 0), 0) / 3;
    
    // Fetch future events to estimate potential revenue
    try {
      const { data: futureEvents } = await supabase
        .from("events")
        .select(`
          id,
          title,
          event_date,
          tickets (
            id,
            price,
            quantity_total,
            quantity_sold
          )
        `)
        .eq("producer_id", user?.id)
        .gte("event_date", now.toISOString())
        .eq("is_active", true);
      
      // Calculate potential revenue from future events
      let potentialRevenue = 0;
      (futureEvents || []).forEach(event => {
        const tickets = event.tickets as any[] || [];
        tickets.forEach(ticket => {
          const remaining = ticket.quantity_total - ticket.quantity_sold;
          // Estimate 50% of remaining tickets will sell
          potentialRevenue += remaining * 0.5 * Number(ticket.price) * 0.85; // 85% after fees estimate
        });
      });
      
      setFutureEventsRevenue(potentialRevenue);
      
      // Generate forecasts for next 3 months
      for (let i = 1; i <= 3; i++) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
        
        // Blend historical average with future events potential
        const monthForecast = avgMonthlyNet * 0.7 + (potentialRevenue / 3) * 0.3;
        
        forecastMonths.push({
          month: format(monthDate, "MMM/yy", { locale: ptBR }),
          actual: null,
          forecast: monthForecast > 0 ? monthForecast : avgMonthlyNet,
        });
      }
    } catch (error) {
      console.error("Error fetching future events:", error);
      // Fallback: use simple average for forecast
      for (let i = 1; i <= 3; i++) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
        forecastMonths.push({
          month: format(monthDate, "MMM/yy", { locale: ptBR }),
          actual: null,
          forecast: avgMonthlyNet,
        });
      }
    }
    
    setForecastData(forecastMonths);
  };

  const clearFilters = () => {
    setEventFilter("all");
    setStatusFilter("all");
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const exportToCSV = () => {
    const headers = ["Data", "Evento", "Ingresso", "Cliente", "Qtd", "Valor Total", "Taxa Plataforma", "Taxa Gateway", "Valor Líquido", "Status", "Pagamento"];
    const rows = filteredSales.map(sale => [
      format(new Date(sale.created_at), "dd/MM/yyyy HH:mm"),
      sale.event_title,
      sale.ticket_name,
      sale.buyer_name,
      sale.quantity,
      sale.total_price.toFixed(2),
      sale.platform_fee.toFixed(2),
      sale.gateway_fee.toFixed(2),
      sale.producer_amount.toFixed(2),
      sale.payment_status === "paid" ? "Pago" : "Pendente",
      sale.payment_method || "-"
    ]);
    
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `transacoes_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("Arquivo exportado com sucesso!");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge variant="default" className="bg-green-600">Pago</Badge>;
      case "pending":
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pendente</Badge>;
      case "failed":
        return <Badge variant="destructive">Falhou</Badge>;
      case "refunded":
        return <Badge variant="secondary">Reembolsado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Pagination
  const totalPages = Math.ceil(filteredSales.length / ITEMS_PER_PAGE);
  const paginatedSales = filteredSales.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Calculate filtered totals
  const filteredTotalRevenue = filteredSales
    .filter(s => s.payment_status === "paid")
    .reduce((sum, s) => sum + s.total_price, 0);
  const filteredNetRevenue = filteredSales
    .filter(s => s.payment_status === "paid")
    .reduce((sum, s) => sum + s.producer_amount, 0);

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!isProducerApproved) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard Financeiro</h1>
        <p className="text-muted-foreground">
          Acompanhe suas receitas, taxas e histórico de transações
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Receita Bruta</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">total de vendas pagas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Taxas</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              - R$ {totalFees.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">plataforma + gateway</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Receita Líquida</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {netRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">após taxas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Saldo Disponível</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              R$ {availableBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Button 
                variant="link" 
                size="sm" 
                className="p-0 h-auto text-xs"
                onClick={() => navigate("/saques")}
              >
                Solicitar saque
                <ArrowUpRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Receita dos Últimos 30 Dias</CardTitle>
          <CardDescription>Evolução diária de vendas e receita líquida</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" tick={{ fill: 'currentColor' }} />
                <YAxis className="text-xs" tick={{ fill: 'currentColor' }} tickFormatter={(value) => `R$${value}`} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, '']}
                />
                <Legend />
                <Bar dataKey="revenue" name="Receita Bruta" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="net" name="Receita Líquida" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Comparison & Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Monthly Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Comparativo Mensal
            </CardTitle>
            <CardDescription>Evolução de receita mês a mês (últimos 6 meses)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {monthlyComparison.map((month, index) => (
                <div key={month.month} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <span className="font-medium capitalize w-16">{month.monthLabel}</span>
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">
                        Líquido: R$ {month.net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {month.growthNet !== null && (
                      <div className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded text-sm font-medium",
                        month.growthNet >= 0 
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      )}>
                        {month.growthNet >= 0 ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4" />
                        )}
                        {month.growthNet >= 0 ? "+" : ""}{month.growthNet.toFixed(1)}%
                      </div>
                    )}
                    {month.growthNet === null && index === 0 && (
                      <span className="text-xs text-muted-foreground">Base</span>
                    )}
                  </div>
                </div>
              ))}
              {monthlyComparison.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Dados insuficientes para comparação</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Revenue Forecast */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PiggyBank className="h-5 w-5" />
              Previsão de Receita
            </CardTitle>
            <CardDescription>Projeção baseada em histórico e eventos futuros</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forecastData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" tick={{ fill: 'currentColor' }} />
                  <YAxis className="text-xs" tick={{ fill: 'currentColor' }} tickFormatter={(value) => `R$${value}`} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number | null, name: string) => [
                      value ? `R$ ${value.toFixed(2)}` : '-', 
                      name === 'actual' ? 'Real' : 'Previsão'
                    ]}
                  />
                  <Legend formatter={(value) => value === 'actual' ? 'Real' : 'Previsão'} />
                  <Bar dataKey="actual" name="actual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="forecast" name="forecast" fill="hsl(var(--primary) / 0.4)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {futureEventsRevenue > 0 && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  <span className="font-medium">Potencial de eventos futuros:</span>
                  <span className="text-primary font-bold">
                    R$ {futureEventsRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Estimativa baseada em 50% dos ingressos restantes
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle>Histórico de Transações</CardTitle>
            <CardDescription>Todas as vendas e pagamentos recebidos</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtros:</span>
            </div>
            
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Evento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os eventos</SelectItem>
                {events.map(event => (
                  <SelectItem key={event.id} value={event.title}>{event.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
              </SelectContent>
            </Select>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "dd/MM/yyyy") : "De"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
              </PopoverContent>
            </Popover>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "dd/MM/yyyy") : "Até"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
              </PopoverContent>
            </Popover>
            
            {(eventFilter !== "all" || statusFilter !== "all" || startDate || endDate) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpar filtros
              </Button>
            )}
          </div>

          {/* Filter summary */}
          {(eventFilter !== "all" || statusFilter !== "all" || startDate || endDate) && (
            <div className="flex gap-4 mb-4 p-3 bg-primary/10 rounded-lg">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Filtrado:</span>
              </div>
              <span className="text-sm">
                {filteredSales.length} transações | 
                Bruto: R$ {filteredTotalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | 
                Líquido: R$ {filteredNetRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {filteredSales.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma transação encontrada</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Taxas</TableHead>
                      <TableHead className="text-right">Líquido</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium truncate max-w-[150px]">{sale.event_title}</p>
                            <p className="text-xs text-muted-foreground">{sale.ticket_name}</p>
                          </div>
                        </TableCell>
                        <TableCell className="truncate max-w-[120px]">{sale.buyer_name}</TableCell>
                        <TableCell className="text-center">{sale.quantity}</TableCell>
                        <TableCell className="text-right font-medium">
                          R$ {sale.total_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right text-red-500">
                          - R$ {(sale.platform_fee + sale.gateway_fee).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          R$ {sale.producer_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>{getStatusBadge(sale.payment_status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredSales.length)} de {filteredSales.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialDashboard;