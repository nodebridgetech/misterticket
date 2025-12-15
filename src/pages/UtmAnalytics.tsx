import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Eye, MousePointerClick, ShoppingCart, TrendingUp, DollarSign, Link } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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
    event_title: string;
  }[];
  totalSold: number;
  totalRevenue: number;
  totalNetRevenue: number;
}

interface UtmLink {
  id: string;
  name: string;
  utm_code: string;
  applies_to_all_events: boolean;
  is_active: boolean;
  commission_type: string;
  commission_value: number;
}

const UtmAnalytics = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [utmLink, setUtmLink] = useState<UtmLink | null>(null);
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
      // Fetch UTM link
      const { data: linkData, error: linkError } = await supabase
        .from("utm_links")
        .select("*")
        .eq("id", id)
        .single();

      if (linkError) throw linkError;

      // Check permissions
      if (userRole !== "admin" && linkData.producer_id !== user?.id) {
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para ver os analytics deste link.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setUtmLink(linkData);

      // Fetch analytics data for this UTM link
      const { data: analyticsData, error: analyticsError } = await supabase
        .from("event_analytics")
        .select("*")
        .eq("utm_link_id", id);

      if (analyticsError) throw analyticsError;

      // Count analytics by type
      const pageViews = analyticsData?.filter(a => a.event_type === 'page_view').length || 0;
      const ticketClicks = analyticsData?.filter(a => a.event_type === 'ticket_click').length || 0;
      const checkoutClicks = analyticsData?.filter(a => a.event_type === 'checkout_click').length || 0;

      // Get unique event IDs from analytics
      const eventIds = [...new Set(analyticsData?.map(a => a.event_id) || [])];
      
      if (eventIds.length === 0) {
        setAnalytics({
          pageViews,
          ticketClicks,
          checkoutClicks,
          ticketStats: [],
          totalSold: 0,
          totalRevenue: 0,
          totalNetRevenue: 0
        });
        setLoading(false);
        return;
      }

      // Fetch events
      const { data: events } = await supabase
        .from("events")
        .select("id, title")
        .in("id", eventIds);

      const eventsMap = (events || []).reduce((acc, e) => {
        acc[e.id] = e.title;
        return acc;
      }, {} as Record<string, string>);

      // Fetch tickets for these events
      const { data: tickets, error: ticketsError } = await supabase
        .from("tickets")
        .select("*")
        .in("event_id", eventIds);

      if (ticketsError) throw ticketsError;

      // Fetch sales that came from this UTM link
      // We need to track sales with utm_link_id - for now we'll use analytics checkout_click data
      const checkoutEventIds = analyticsData
        ?.filter(a => a.event_type === 'checkout_click')
        .map(a => a.event_id) || [];

      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("*")
        .in("event_id", checkoutEventIds)
        .eq("payment_status", "paid");

      if (salesError) throw salesError;

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
          clicks,
          event_title: eventsMap[ticket.event_id] || "Evento"
        };
      }).filter(t => t.clicks > 0 || t.quantity_sold > 0) || [];

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
        description: "Erro ao carregar analytics do link UTM.",
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

  if (!utmLink || !analytics) {
    return null;
  }

  // Calculate commission
  const calculateCommission = () => {
    if (!utmLink.commission_value || utmLink.commission_value === 0) return 0;
    
    if (utmLink.commission_type === 'percentage') {
      return (analytics.totalRevenue * utmLink.commission_value) / 100;
    } else {
      return analytics.totalSold * utmLink.commission_value;
    }
  };

  const totalCommission = calculateCommission();

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/links-utm")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div className="flex items-center gap-3">
          <Link className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Analytics do Link UTM</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-muted-foreground">{utmLink.name}</p>
              <Badge variant="outline">{utmLink.utm_code}</Badge>
              {utmLink.is_active ? (
                <Badge>Ativo</Badge>
              ) : (
                <Badge variant="secondary">Inativo</Badge>
              )}
              {utmLink.commission_value > 0 && (
                <Badge>
                  Comissão: {utmLink.commission_type === 'percentage' 
                    ? `${utmLink.commission_value}%`
                    : `R$ ${Number(utmLink.commission_value).toFixed(2).replace('.', ',')} por ingresso`
                  }
                </Badge>
              )}
            </div>
          </div>
        </div>
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
            <p className="text-xs text-muted-foreground">Visitas via este link</p>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturamento Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {analytics.totalRevenue.toFixed(2).replace('.', ',')}
            </div>
            <p className="text-xs text-muted-foreground">Valor bruto das vendas via este link</p>
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

        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comissão a Pagar</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              R$ {totalCommission.toFixed(2).replace('.', ',')}
            </div>
            <p className="text-xs text-muted-foreground">
              {utmLink.commission_value > 0 
                ? (utmLink.commission_type === 'percentage' 
                    ? `${utmLink.commission_value}% do faturamento`
                    : `R$ ${Number(utmLink.commission_value).toFixed(2).replace('.', ',')} × ${analytics.totalSold} ingressos`)
                : 'Nenhuma comissão configurada'}
            </p>
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
                  <TableHead>Evento</TableHead>
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
                    <TableCell className="font-medium">{ticket.event_title}</TableCell>
                    <TableCell>{ticket.batch_name}</TableCell>
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
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Nenhuma interação registrada via este link ainda
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

export default UtmAnalytics;
