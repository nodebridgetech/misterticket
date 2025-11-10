import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Users, DollarSign, TrendingUp, Plus } from "lucide-react";

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

  const stats = [
    {
      title: "Eventos Ativos",
      value: "0",
      icon: CalendarDays,
      description: "eventos publicados",
    },
    {
      title: "Total de Vendas",
      value: "0",
      icon: Users,
      description: "ingressos vendidos",
    },
    {
      title: "Receita Total",
      value: "R$ 0,00",
      icon: DollarSign,
      description: "bruto",
    },
    {
      title: "Taxa Média",
      value: "0%",
      icon: TrendingUp,
      description: "de conversão",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Painel do Produtor</h1>
            <p className="text-muted-foreground">
              Gerencie seus eventos e acompanhe suas vendas
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Meus Eventos</CardTitle>
              <CardDescription>
                Lista dos seus eventos publicados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  Você ainda não criou nenhum evento
                </p>
                <Button onClick={() => navigate("/criar-evento")}>Criar meu primeiro evento</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Solicitações de Saque</CardTitle>
              <CardDescription>
                Histórico de saques e repasses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma solicitação de saque pendente
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProducerDashboard;
