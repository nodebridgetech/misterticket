import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Eye, MousePointerClick, ShoppingCart, TrendingUp, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AnalyticsData {
  pageViews: number;
  ticketClicks: number;
  checkoutClicks: number;
  ticketStats: {
    id: string;
    batch_name: string;
    sector: string | null;
    price: number;
    quantity_sold: number;
    total_revenue: number;
    net_revenue: number;
    clicks: number;
  }[];
  totalSold: number;
  totalRevenue: number;
  totalNetRevenue: number;
}

const EventAnalytics = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [event, setEvent] = useState<any>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (id) {
      fetchAnalytics();
    }
  }, [id, user]);

  const fetchAnalytics = async () => {
    try {
      // Fetch event
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", id)
        .single();

      if (eventError) throw eventError;

      // Check permissions
      if (userRole !== "admin" && eventData.producer_id !== user?.id) {
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para ver os analytics deste evento.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setEvent(eventData);

      // Fetch analytics data
      const { data: analyticsData, error: analyticsError } = await supabase
        .from("event_analytics")
        .select("*")
        .eq("event_id", id);

      if (analyticsError) throw analyticsError;

      // Count analytics by type
      const pageViews = analyticsData?.filter(a => a.event_type === 'page_view').length || 0;
      const ticketClicks = analyticsData?.filter(a => a.event_type === 'ticket_click').length || 0;
      const checkoutClicks = analyticsData?.filter(a => a.event_type === 'checkout_click').length || 0;

      // Fetch tickets and sales
      const { data: tickets, error: ticketsError } = await supabase
        .from("tickets")
        .select("*")
        .eq("event_id", id);

      if (ticketsError) throw ticketsError;

      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("*")
        .eq("event_id", id)
        .eq("payment_status", "paid");

      if (salesError) throw salesError;

      // Get active fee config
      const { data: feeConfig } = await supabase
        .from("fee_config")
        .select("*")
        .eq("is_active", true)
        .single();

      const platformFee = feeConfig?.platform_fee_percentage || 10;
      const gatewayFee = feeConfig?.payment_gateway_fee_percentage || 3;

      // Calculate stats per ticket
      const ticketStats = tickets?.map(ticket => {
        const ticketSales = sales?.filter(s => s.ticket_id === ticket.id) || [];
        const quantity_sold = ticketSales.reduce((acc, s) => acc + s.quantity, 0);
        const total_revenue = ticketSales.reduce((acc, s) => acc + Number(s.total_price), 0);
        const net_revenue = ticketSales.reduce((acc, s) => acc + Number(s.producer_amount), 0);
        const clicks = analyticsData?.filter(a => a.event_type === 'ticket_click' && a.ticket_id === ticket.id).length || 0;

        return {
          id: ticket.id,
          batch_name: ticket.batch_name,
          sector: ticket.sector,
          price: Number(ticket.price),
          quantity_sold,
          total_revenue,
          net_revenue,
          clicks
        };
      }) || [];

      const totalSold = ticketStats.reduce((acc, t) => acc + t.quantity_sold, 0);
      const totalRevenue = ticketStats.reduce((acc, t) => acc + t.total_revenue, 0);
      const totalNetRevenue = ticketStats.reduce((acc, t) => acc + t.net_revenue, 0);

      setAnalytics({
        pageViews,
        ticketClicks,
        checkoutClicks,
        ticketStats,
        totalSold,
        totalRevenue,
        totalNetRevenue
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar analytics do evento.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Carregando analytics...</p>
      </div>
    );
  }

  if (!event || !analytics) {
    return null;
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h1 className="text-2xl md:text-3xl font-bold">Analytics do Evento</h1>
        <p className="text-muted-foreground mt-2">{event.title}</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visualizações</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.pageViews}</div>
            <p className="text-xs text-muted-foreground">Visitas à página do evento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cliques em Comprar</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.ticketClicks}</div>
            <p className="text-xs text-muted-foreground">Total de cliques nos lotes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ir para Pagamento</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.checkoutClicks}</div>
            <p className="text-xs text-muted-foreground">Cliques no checkout</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingressos Vendidos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalSold}</div>
            <p className="text-xs text-muted-foreground">Total de ingressos</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturamento Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {analytics.totalRevenue.toFixed(2).replace('.', ',')}
            </div>
            <p className="text-xs text-muted-foreground">Valor bruto das vendas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Líquido</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              R$ {analytics.totalNetRevenue.toFixed(2).replace('.', ',')}
            </div>
            <p className="text-xs text-muted-foreground">Após taxas da plataforma</p>
          </CardContent>
        </Card>
      </div>

      {/* Ticket Stats Table */}
      <Card>
        <CardHeader>
          <CardTitle>Estatísticas por Lote</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lote</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                  <TableHead className="text-right">Vendidos</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-right">Valor Líquido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.ticketStats.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium">{ticket.batch_name}</TableCell>
                    <TableCell>{ticket.sector || "-"}</TableCell>
                    <TableCell className="text-right">
                      R$ {ticket.price.toFixed(2).replace('.', ',')}
                    </TableCell>
                    <TableCell className="text-right">{ticket.clicks}</TableCell>
                    <TableCell className="text-right">{ticket.quantity_sold}</TableCell>
                    <TableCell className="text-right">
                      R$ {ticket.total_revenue.toFixed(2).replace('.', ',')}
                    </TableCell>
                    <TableCell className="text-right text-primary font-semibold">
                      R$ {ticket.net_revenue.toFixed(2).replace('.', ',')}
                    </TableCell>
                  </TableRow>
                ))}
                {analytics.ticketStats.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Nenhum lote cadastrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EventAnalytics;
