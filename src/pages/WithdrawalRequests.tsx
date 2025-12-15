import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, Plus, AlertCircle, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface WithdrawalRequest {
  id: string;
  amount: number;
  status: string;
  producer_document: string;
  rejection_reason: string | null;
  created_at: string;
  approved_at: string | null;
}

const WithdrawalRequests = () => {
  const { user, isProducerApproved, loading } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [withdrawnAmount, setWithdrawnAmount] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [userDocument, setUserDocument] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [minWithdrawal, setMinWithdrawal] = useState(50);

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

  const fetchData = async () => {
    setLoadingData(true);
    try {
      // Fetch user profile document
      const { data: profile } = await supabase
        .from("profiles")
        .select("document")
        .eq("user_id", user?.id)
        .single();

      setUserDocument(profile?.document || null);

      // Fetch fee config for min withdrawal
      const { data: feeConfig } = await supabase
        .from("fee_config")
        .select("min_withdrawal_amount")
        .eq("is_active", true)
        .single();

      if (feeConfig) {
        setMinWithdrawal(Number(feeConfig.min_withdrawal_amount));
      }

      // Fetch withdrawal requests
      const { data: withdrawals } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("producer_id", user?.id)
        .order("created_at", { ascending: false });

      setRequests(withdrawals || []);

      // Calculate withdrawn and pending amounts
      const withdrawn = (withdrawals || [])
        .filter(w => w.status === 'completed')
        .reduce((sum, w) => sum + Number(w.amount), 0);

      const pending = (withdrawals || [])
        .filter(w => ['pending', 'approved', 'processing'].includes(w.status))
        .reduce((sum, w) => sum + Number(w.amount), 0);

      setWithdrawnAmount(withdrawn);
      setPendingAmount(pending);

      // Fetch total producer revenue from sales
      const { data: sales } = await supabase
        .from("sales")
        .select(`
          producer_amount,
          events!inner (producer_id)
        `)
        .eq("events.producer_id", user?.id)
        .eq("payment_status", "paid");

      const totalRevenue = (sales || []).reduce((sum, sale) => sum + Number(sale.producer_amount), 0);
      setAvailableBalance(totalRevenue - withdrawn - pending);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!userDocument) {
      toast.error("Você precisa informar seu CPF ou CNPJ no cadastro para solicitar saques");
      return;
    }

    const requestedAmount = Number(amount);
    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    if (requestedAmount < minWithdrawal) {
      toast.error(`O valor mínimo para saque é R$ ${minWithdrawal.toFixed(2)}`);
      return;
    }

    if (requestedAmount > availableBalance) {
      toast.error("Saldo insuficiente");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("withdrawal_requests").insert({
        producer_id: user?.id,
        amount: requestedAmount,
        producer_document: userDocument,
      });

      if (error) throw error;

      toast.success("Solicitação de saque enviada com sucesso!");
      setDialogOpen(false);
      setAmount("");
      fetchData();
    } catch (error) {
      console.error("Error submitting withdrawal request:", error);
      toast.error("Erro ao enviar solicitação");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case "approved":
        return <Badge variant="outline" className="text-blue-600 border-blue-600"><CheckCircle className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case "processing":
        return <Badge variant="outline" className="text-blue-600 border-blue-600"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processando</Badge>;
      case "completed":
        return <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Concluído</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejeitado</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

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
        <h1 className="text-3xl font-bold mb-2">Solicitações de Saque</h1>
        <p className="text-muted-foreground">
          Gerencie seus saques e acompanhe o status das solicitações
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Saldo Disponível</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {availableBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">disponível para saque</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Em Processamento</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              R$ {pendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">aguardando aprovação</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Sacado</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {withdrawnAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">saques concluídos</p>
          </CardContent>
        </Card>
      </div>

      {!userDocument && (
        <Alert className="mb-6 border-yellow-600">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription>
            <strong>Atenção:</strong> Para solicitar saques, você precisa informar seu CPF ou CNPJ no seu cadastro.{" "}
            <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/minha-conta?tab=dados")}>
              Atualizar cadastro
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Histórico de Solicitações</CardTitle>
            <CardDescription>Acompanhe todas as suas solicitações de saque</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!userDocument || availableBalance < minWithdrawal}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Solicitação
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Solicitar Saque</DialogTitle>
                <DialogDescription>
                  Informe o valor que deseja sacar. O valor mínimo é R$ {minWithdrawal.toFixed(2)}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Saldo Disponível</Label>
                  <p className="text-lg font-bold text-green-600">
                    R$ {availableBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Valor do Saque (R$)</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0,00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min={minWithdrawal}
                    max={availableBalance}
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CPF/CNPJ do Destinatário</Label>
                  <p className="text-sm text-muted-foreground">{userDocument}</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmitRequest} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Solicitar Saque
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma solicitação de saque</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      {format(new Date(request.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium">
                      R$ {Number(request.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>{request.producer_document}</TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {request.rejection_reason || (request.approved_at && `Aprovado em ${format(new Date(request.approved_at), "dd/MM/yyyy", { locale: ptBR })}`)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WithdrawalRequests;
