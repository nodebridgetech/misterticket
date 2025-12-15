import { useEffect, useState } from "react";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, Ticket, AlertCircle, Calendar, MapPin, QrCode, Pencil, Save, X, Loader2, Send, UserPlus, Smartphone, Download, CheckCircle, Share, MoreVertical, Monitor } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { formatCPF, formatPhone, isValidCPF } from "@/lib/format-utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { TicketTransferDialog } from "@/components/TicketTransferDialog";
import { RefundPolicyInfo } from "@/components/RefundPolicyInfo";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

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
  const { user, signOut, userRole, requestProducerRole, isProducerApproved, hasPendingProducerRequest } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);
  const [loadingCep, setLoadingCep] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedSaleForTransfer, setSelectedSaleForTransfer] = useState<Sale | null>(null);
  
  // Estados para Install App (PWA)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  
  // Estados para edição
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: "",
    phone: "",
    document: "",
    cep: "",
    address: "",
    address_number: "",
    address_complement: "",
    birth_date: undefined as Date | undefined
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
          document: data.document || "",
          cep: data.cep || "",
          address: data.address || "",
          address_number: data.address_number || "",
          address_complement: data.address_complement || "",
          birth_date: data.birth_date ? new Date(data.birth_date) : undefined
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

  // PWA Install detection
  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    const android = /Android/.test(navigator.userAgent);
    setIsAndroid(android);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      toast.error("Instalação não disponível neste navegador");
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      toast.success("App instalado com sucesso!");
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
  };

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
      document: profile?.document || "",
      cep: profile?.cep || "",
      address: profile?.address || "",
      address_number: profile?.address_number || "",
      address_complement: profile?.address_complement || "",
      birth_date: profile?.birth_date ? new Date(profile.birth_date) : undefined
    });
  };

  const formatCep = (value: string): string => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 5) return numbers;
    return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
  };

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedCep = formatCep(e.target.value);
    setEditForm({ ...editForm, cep: formattedCep });
    
    const cepNumbers = formattedCep.replace(/\D/g, "");
    if (cepNumbers.length === 8) {
      await fetchAddress(cepNumbers);
    }
  };

  const fetchAddress = async (cepValue: string) => {
    setLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepValue}/json/`);
      const data: ViaCepResponse = await response.json();
      
      if (data.erro) {
        toast.error("CEP não encontrado");
        return;
      }
      
      const fullAddress = [
        data.logradouro,
        data.bairro,
        `${data.localidade} - ${data.uf}`
      ].filter(Boolean).join(", ");
      
      setEditForm(prev => ({
        ...prev,
        address: fullAddress
      }));
      
      toast.success("Endereço encontrado!");
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      toast.error("Erro ao buscar endereço");
    } finally {
      setLoadingCep(false);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditForm({ ...editForm, phone: formatPhone(e.target.value) });
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditForm({ ...editForm, document: formatCPF(e.target.value) });
  };

  const handleSaveProfile = async () => {
    if (!editForm.full_name.trim()) {
      toast.error("O nome completo é obrigatório");
      return;
    }

    // Validar CPF se preenchido
    const cpfNumbers = editForm.document.replace(/\D/g, "");
    if (cpfNumbers.length > 0 && !isValidCPF(editForm.document)) {
      toast.error("CPF inválido");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editForm.full_name.trim(),
          phone: editForm.phone.trim() || null,
          document: editForm.document.trim() || null,
          cep: editForm.cep.trim() || null,
          address: editForm.address.trim() || null,
          address_number: editForm.address_number.trim() || null,
          address_complement: editForm.address_complement.trim() || null,
          birth_date: editForm.birth_date ? format(editForm.birth_date, "yyyy-MM-dd") : null
        })
        .eq("user_id", user!.id);

      if (error) throw error;

      setProfile({
        ...profile,
        full_name: editForm.full_name.trim(),
        phone: editForm.phone.trim() || null,
        document: editForm.document.trim() || null,
        cep: editForm.cep.trim() || null,
        address: editForm.address.trim() || null,
        address_number: editForm.address_number.trim() || null,
        address_complement: editForm.address_complement.trim() || null,
        birth_date: editForm.birth_date ? format(editForm.birth_date, "yyyy-MM-dd") : null
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
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="profile">
              <User className="h-4 w-4 mr-2" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="tickets">
              <Ticket className="h-4 w-4 mr-2" />
              Meus Ingressos
            </TabsTrigger>
            {!isProducerApproved && (
              <TabsTrigger value="become-producer">
                <UserPlus className="h-4 w-4 mr-2" />
                Tornar-se Produtor
              </TabsTrigger>
            )}
            {userRole === "producer" && (
              <TabsTrigger value="install">
                <Smartphone className="h-4 w-4 mr-2" />
                Instalar App
              </TabsTrigger>
            )}
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
                      onChange={handlePhoneChange}
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
                      onChange={handleDocumentChange}
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

                <div className="space-y-2">
                  <Label>Data de Nascimento</Label>
                  {isEditing ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !editForm.birth_date && "text-muted-foreground"
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {editForm.birth_date 
                            ? format(editForm.birth_date, "dd/MM/yyyy") 
                            : "Selecione a data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={editForm.birth_date}
                          onSelect={(date) => setEditForm({ ...editForm, birth_date: date })}
                          disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Input 
                      placeholder="Não informado" 
                      value={profile?.birth_date ? format(new Date(profile.birth_date), "dd/MM/yyyy") : ""} 
                      disabled 
                    />
                  )}
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-4">Endereço</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>CEP</Label>
                      {isEditing ? (
                        <div className="relative">
                          <Input 
                            value={editForm.cep} 
                            onChange={handleCepChange}
                            placeholder="00000-000"
                            maxLength={9}
                          />
                          {loadingCep && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                        </div>
                      ) : (
                        <Input 
                          placeholder="Não informado" 
                          value={profile?.cep || ""} 
                          disabled 
                        />
                      )}
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Endereço</Label>
                      {isEditing ? (
                        <Input 
                          value={editForm.address} 
                          onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                          placeholder="Rua, Bairro, Cidade - UF"
                        />
                      ) : (
                        <Input 
                          placeholder="Não informado" 
                          value={profile?.address || ""} 
                          disabled 
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Número</Label>
                      {isEditing ? (
                        <Input 
                          value={editForm.address_number} 
                          onChange={(e) => setEditForm({ ...editForm, address_number: e.target.value })}
                          placeholder="Número"
                        />
                      ) : (
                        <Input 
                          placeholder="Não informado" 
                          value={profile?.address_number || ""} 
                          disabled 
                        />
                      )}
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Complemento</Label>
                      {isEditing ? (
                        <Input 
                          value={editForm.address_complement} 
                          onChange={(e) => setEditForm({ ...editForm, address_complement: e.target.value })}
                          placeholder="Apartamento, bloco, etc."
                        />
                      ) : (
                        <Input 
                          placeholder="Não informado" 
                          value={profile?.address_complement || ""} 
                          disabled 
                        />
                      )}
                    </div>
                  </div>
                </div>
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
              {/* Refund Policy Info */}
              <RefundPolicyInfo />

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
                sales.map((sale) => {
                  const eventDate = new Date(sale.events.event_date);
                  const isPastEvent = eventDate < new Date();
                  const canTransfer = sale.payment_status === "paid" && !isPastEvent;
                  
                  return (
                    <Card key={sale.id}>
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row gap-6">
                          <div className="flex-1 space-y-4">
                            <div className="flex items-start justify-between flex-wrap gap-2">
                              <div>
                                <h3 className="text-xl font-semibold mb-2">{sale.events.title}</h3>
                                <div className="space-y-1 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    <span>
                                      {format(eventDate, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4" />
                                    <span>{sale.events.venue} - {sale.events.address}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {canTransfer && (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      setSelectedSaleForTransfer(sale);
                                      setTransferDialogOpen(true);
                                    }}
                                  >
                                    <Send className="h-4 w-4 mr-1" />
                                    Transferir
                                  </Button>
                                )}
                                <Badge variant={sale.payment_status === "paid" ? "default" : "secondary"}>
                                  {sale.payment_status === "paid" ? "Pago" : "Pendente"}
                                </Badge>
                              </div>
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
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* Tornar-se Produtor Tab */}
          {!isProducerApproved && (
            <TabsContent value="become-producer">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Tornar-se Produtor
                  </CardTitle>
                  <CardDescription>
                    Crie e gerencie seus próprios eventos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {hasPendingProducerRequest ? (
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
            </TabsContent>
          )}

          {/* Instalar App Tab - Only for Producers */}
          {userRole === "producer" && (
            <TabsContent value="install">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <Smartphone className="h-6 w-6 text-primary" />
                    Instalar Mister Ticket
                  </CardTitle>
                  <CardDescription className="text-base">
                    Tenha acesso rápido ao Mister Ticket direto da tela inicial do seu dispositivo
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isInstalled ? (
                    <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <AlertDescription className="text-base font-medium">
                        O app já está instalado no seu dispositivo!
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      {deferredPrompt && (
                        <div className="space-y-4">
                          <Button 
                            onClick={handleInstallClick} 
                            size="lg" 
                            className="w-full"
                          >
                            <Download className="mr-2 h-5 w-5" />
                            Instalar Aplicativo
                          </Button>
                          <p className="text-sm text-muted-foreground text-center">
                            Clique no botão acima para instalar o app diretamente
                          </p>
                        </div>
                      )}

                      {isIOS && !deferredPrompt && (
                        <div className="space-y-4">
                          <Alert>
                            <Smartphone className="h-5 w-5" />
                            <AlertDescription className="text-base">
                              No iOS/iPhone, use o Safari para instalar
                            </AlertDescription>
                          </Alert>
                          
                          <div className="space-y-4 p-4 bg-muted rounded-lg">
                            <h3 className="font-semibold text-lg">Como instalar no iPhone/iPad:</h3>
                            <ol className="space-y-3 list-decimal list-inside text-sm md:text-base">
                              <li className="flex items-start gap-2">
                                <Share className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
                                <span>Toque no botão de <strong>Compartilhar</strong></span>
                              </li>
                              <li className="flex items-start gap-2">
                                <Download className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
                                <span>Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong></span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
                                <span>Toque em <strong>"Adicionar"</strong></span>
                              </li>
                            </ol>
                          </div>
                        </div>
                      )}

                      {isAndroid && !deferredPrompt && (
                        <div className="space-y-4">
                          <Alert>
                            <Smartphone className="h-5 w-5" />
                            <AlertDescription className="text-base">
                              No Android, use o Chrome para instalar
                            </AlertDescription>
                          </Alert>
                          
                          <div className="space-y-4 p-4 bg-muted rounded-lg">
                            <h3 className="font-semibold text-lg">Como instalar no Android:</h3>
                            <ol className="space-y-3 list-decimal list-inside text-sm md:text-base">
                              <li className="flex items-start gap-2">
                                <MoreVertical className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
                                <span>Toque no menu <strong>(⋮)</strong></span>
                              </li>
                              <li className="flex items-start gap-2">
                                <Download className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
                                <span>Toque em <strong>"Instalar aplicativo"</strong></span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
                                <span>Confirme tocando em <strong>"Instalar"</strong></span>
                              </li>
                            </ol>
                          </div>
                        </div>
                      )}

                      {!isIOS && !isAndroid && !deferredPrompt && (
                        <div className="space-y-4">
                          <Alert>
                            <Monitor className="h-5 w-5" />
                            <AlertDescription className="text-base">
                              No computador, use Chrome, Edge ou outro navegador compatível
                            </AlertDescription>
                          </Alert>
                          
                          <div className="space-y-4 p-4 bg-muted rounded-lg">
                            <h3 className="font-semibold text-lg">Como instalar no Desktop:</h3>
                            <ol className="space-y-3 list-decimal list-inside text-sm md:text-base">
                              <li className="flex items-start gap-2">
                                <Download className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
                                <span>Procure pelo ícone de <strong>instalação</strong> na barra de endereços</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <CheckCircle className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
                                <span>Clique em <strong>"Instalar"</strong></span>
                              </li>
                            </ol>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="space-y-4 pt-6 border-t border-border">
                    <h3 className="font-semibold text-lg">Benefícios do App:</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                        <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Acesso Rápido</p>
                          <p className="text-sm text-muted-foreground">Abra direto da tela inicial</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                        <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Scanner de QR Code</p>
                          <p className="text-sm text-muted-foreground">Use a câmera para validar ingressos</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                        <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Funciona Offline</p>
                          <p className="text-sm text-muted-foreground">Acesse mesmo sem internet</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                        <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Notificações</p>
                          <p className="text-sm text-muted-foreground">Receba atualizações importantes</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Ticket Transfer Dialog */}
      {selectedSaleForTransfer && (
        <TicketTransferDialog
          open={transferDialogOpen}
          onOpenChange={setTransferDialogOpen}
          sale={selectedSaleForTransfer}
          onTransferComplete={() => {
            // Reload sales after transfer
            const fetchSales = async () => {
              setLoadingSales(true);
              const { data } = await supabase
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
                .eq("buyer_id", user!.id)
                .order("created_at", { ascending: false });
              if (data) setSales(data as Sale[]);
              setLoadingSales(false);
            };
            fetchSales();
            setSelectedSaleForTransfer(null);
          }}
        />
      )}

      <Footer />
    </>
  );
};

export default MyAccount;
