import { useEffect, useState } from "react";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Ticket, AlertCircle, Calendar, MapPin, QrCode, Pencil, Save, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface Sale {
  id: string;
  quantity: number;
  total_price: number;
  payment_status: string;
  qr_code: string | null;
  created_at: string;
  event_id: string;
  ticket_id: string;
  events: {
    title: string;
    event_date: string;
    venue: string;
    address: string;
    image_url: string | null;
  };
  tickets: {
    batch_name: string;
    sector: string | null;
  };
}

const MyAccount = () => {
  const { user, signOut, requestProducerRole, isProducerApproved, hasPendingProducerRequest } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);
  
  // Estados para edição
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: "",
    phone: "",
    document: ""
  });

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      
      setProfile(data);
      if (data) {
        setEditForm({
          full_name: data.full_name || "",
          phone: data.phone || "",
          document: data.document || ""
        });
      }
      setLoading(false);
    };

    const fetchSales = async () => {
      setLoadingSales(true);
      const { data, error } = await supabase
        .from("sales")
        .select(`
          id,
          quantity,
          total_price,
          payment_status,
          qr_code,
          created_at,
          event_id,
          ticket_id,
          events (
            title,
            event_date,
            venue,
            address,
            image_url
          ),
          tickets (
            batch_name,
            sector
          )
        `)
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar ingressos:", error);
        toast.error("Erro ao carregar seus ingressos");
      } else {
        setSales(data as Sale[]);
      }
      setLoadingSales(false);
    };

    fetchProfile();
    fetchSales();
  }, [user, navigate]);

  const handleBecomeProducer = async () => {
    try {
      await requestProducerRole();
    } catch (error) {
      console.error(error);
    }
  };

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({
      full_name: profile?.full_name || "",
      phone: profile?.phone || "",
      document: profile?.document || ""
    });
  };

  const handleSaveProfile = async () => {
    if (!editForm.full_name.trim()) {
      toast.error("O nome completo é obrigatório");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editForm.full_name.trim(),
          phone: editForm.phone.trim() || null,
          document: editForm.document.trim() || null
        })
        .eq("user_id", user!.id);

      if (error) throw error;

      setProfile({
        ...profile,
        full_name: editForm.full_name.trim(),
        phone: editForm.phone.trim() || null,
        document: editForm.document.trim() || null
      });
      setIsEditing(false);
      toast.success("Perfil atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      toast.error("Erro ao atualizar perfil");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <>
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">Minha Conta</h1>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">
              <User className="h-4 w-4 mr-2" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="tickets">
              <Ticket className="h-4 w-4 mr-2" />
              Meus Ingressos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle>Informações Pessoais</CardTitle>
                  <CardDescription>
                    Gerencie seus dados pessoais
                  </CardDescription>
                </div>
                {!isEditing ? (
                  <Button variant="outline" size="sm" onClick={handleEditClick}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Salvar
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  {isEditing ? (
                    <Input 
                      value={editForm.full_name} 
                      onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                      placeholder="Seu nome completo"
                    />
                  ) : (
                    <Input value={profile?.full_name || ""} disabled />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input value={user?.email || ""} disabled />
                  {isEditing && (
                    <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  {isEditing ? (
                    <Input 
                      value={editForm.phone} 
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      placeholder="(00) 00000-0000"
                    />
                  ) : (
                    <Input 
                      placeholder="Não informado" 
                      value={profile?.phone || ""} 
                      disabled 
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  {isEditing ? (
                    <Input 
                      value={editForm.document} 
                      onChange={(e) => setEditForm({ ...editForm, document: e.target.value })}
                      placeholder="000.000.000-00"
                    />
                  ) : (
                    <Input 
                      placeholder="Não informado" 
                      value={profile?.document || ""} 
                      disabled 
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tornar-se Produtor</CardTitle>
                <CardDescription>
                  Crie e gerencie seus próprios eventos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isProducerApproved ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Você já é um produtor aprovado! Acesse o painel de produtor para gerenciar seus eventos.
                    </p>
                    <Button onClick={() => navigate("/painel")}>
                      Ir para o Painel
                    </Button>
                  </div>
                ) : hasPendingProducerRequest ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium mb-1 text-yellow-900 dark:text-yellow-100">
                          Solicitação em análise
                        </p>
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          Sua solicitação para se tornar produtor está aguardando aprovação do administrador.
                        </p>
                      </div>
                    </div>
                    <Button disabled variant="secondary">
                      Solicitação Pendente
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                      <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium mb-1">
                          Solicite acesso de produtor
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Após aprovação do administrador, você poderá criar e gerenciar eventos.
                        </p>
                      </div>
                    </div>
                    <Button onClick={handleBecomeProducer} variant="default">
                      Solicitar acesso de produtor
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ações da Conta</CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" onClick={signOut}>
                  Sair da conta
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tickets">
            <div className="space-y-4">
              {loadingSales ? (
                <Card>
                  <CardContent className="py-12">
                    <p className="text-center text-muted-foreground">Carregando...</p>
                  </CardContent>
                </Card>
              ) : sales.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Meus Ingressos</CardTitle>
                    <CardDescription>
                      Visualize todos os seus ingressos comprados
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <Ticket className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Você ainda não possui ingressos
                      </p>
                      <Button 
                        className="mt-4" 
                        onClick={() => navigate("/eventos")}
                      >
                        Explorar Eventos
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                sales.map((sale) => (
                  <Card key={sale.id}>
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-1 space-y-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="text-xl font-semibold mb-2">{sale.events.title}</h3>
                              <div className="space-y-1 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4" />
                                  <span>
                                    {format(new Date(sale.events.event_date), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4" />
                                  <span>{sale.events.venue} - {sale.events.address}</span>
                                </div>
                              </div>
                            </div>
                            <Badge variant={sale.payment_status === "paid" ? "default" : "secondary"}>
                              {sale.payment_status === "paid" ? "Pago" : "Pendente"}
                            </Badge>
                          </div>

                          <div className="border-t pt-4 space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Lote:</span>
                              <span className="font-medium">{sale.tickets.batch_name}</span>
                            </div>
                            {sale.tickets.sector && (
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Setor:</span>
                                <span className="font-medium">{sale.tickets.sector}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Quantidade:</span>
                              <span className="font-medium">{sale.quantity} ingresso(s)</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Total:</span>
                              <span className="font-semibold">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sale.total_price)}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Data da compra:</span>
                              <span className="font-medium">
                                {format(new Date(sale.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                          </div>
                        </div>

                        {sale.qr_code && sale.payment_status === "paid" && (
                          <div className="flex flex-col items-center justify-center gap-3 md:border-l md:pl-6">
                            <div className="bg-white p-4 rounded-lg">
                              <img 
                                src={sale.qr_code} 
                                alt="QR Code do ingresso" 
                                className="w-48 h-48"
                              />
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <QrCode className="h-4 w-4" />
                              <span>Apresente na entrada</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </>
  );
};

export default MyAccount;
