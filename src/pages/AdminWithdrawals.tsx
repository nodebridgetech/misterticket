import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, Clock, CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";

interface WithdrawalRequest {
  id: string;
  producer_id: string;
  amount: number;
  status: string;
  producer_document: string;
  stripe_payout_id: string | null;
  rejection_reason: string | null;
  approved_at: string | null;
  created_at: string;
  producer_name?: string;
  producer_email?: string;
}

const AdminWithdrawals = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequest | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [processing, setProcessing] = useState(false);

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
      const { data: withdrawals, error } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch producer profiles
      const producerIds = [...new Set((withdrawals || []).map(w => w.producer_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", producerIds);

      const requestsWithProfiles = (withdrawals || []).map(request => {
        const profile = profiles?.find(p => p.user_id === request.producer_id);
        return {
          ...request,
          producer_name: profile?.full_name || "Desconhecido",
          producer_email: profile?.email || "",
        };
      });

      setRequests(requestsWithProfiles);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoadingData(false);
    }
  };

  const handleAction = async () => {
    if (!selectedRequest) return;

    setProcessing(true);
    try {
      if (actionType === "approve") {
        // Call edge function to process payout
        const { data, error } = await supabase.functions.invoke("process-withdrawal", {
          body: { withdrawalId: selectedRequest.id },
        });

        if (error) throw error;

        if (data?.error) {
          throw new Error(data.error);
        }

        toast.success("Saque aprovado e processado com sucesso!");
      } else {
        // Reject the request
        const { error } = await supabase
          .from("withdrawal_requests")
          .update({
            status: "rejected",
            rejection_reason: rejectionReason,
            approved_by: user?.id,
            approved_at: new Date().toISOString(),
          })
          .eq("id", selectedRequest.id);

        if (error) throw error;

        toast.success("Solicitação rejeitada");
      }

      setActionDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason("");
      fetchData();
    } catch (error: any) {
      console.error("Error processing action:", error);
      toast.error(error.message || "Erro ao processar ação");
    } finally {
      setProcessing(false);
    }
  };

  const openActionDialog = (request: WithdrawalRequest, type: "approve" | "reject") => {
    setSelectedRequest(request);
    setActionType(type);
    setRejectionReason("");
    setActionDialogOpen(true);
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

  const pendingRequests = requests.filter(r => r.status === "pending");
  const processedRequests = requests.filter(r => r.status !== "pending");

  const totalPending = pendingRequests.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalApproved = requests
    .filter(r => ["completed", "approved", "processing"].includes(r.status))
    .reduce((sum, r) => sum + Number(r.amount), 0);

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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Solicitações de Saque</h1>
        <p className="text-muted-foreground">
          Gerencie as solicitações de saque dos produtores
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRequests.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} aguardando
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Aprovado</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {totalApproved.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">saques processados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Solicitações</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{requests.length}</div>
            <p className="text-xs text-muted-foreground mt-1">todas as solicitações</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Saques</CardTitle>
          <CardDescription>Aprove ou rejeite as solicitações de saque dos produtores</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending">
            <TabsList>
              <TabsTrigger value="pending">
                Pendentes ({pendingRequests.length})
              </TabsTrigger>
              <TabsTrigger value="processed">
                Processadas ({processedRequests.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhuma solicitação pendente</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Produtor</TableHead>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          {format(new Date(request.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{request.producer_name}</p>
                            <p className="text-sm text-muted-foreground">{request.producer_email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{request.producer_document}</TableCell>
                        <TableCell className="font-medium">
                          R$ {Number(request.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => openActionDialog(request, "approve")}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openActionDialog(request, "reject")}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Rejeitar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="processed" className="mt-4">
              {processedRequests.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhuma solicitação processada</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Produtor</TableHead>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          {format(new Date(request.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{request.producer_name}</p>
                            <p className="text-sm text-muted-foreground">{request.producer_email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{request.producer_document}</TableCell>
                        <TableCell className="font-medium">
                          R$ {Number(request.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {request.rejection_reason || (request.stripe_payout_id && `Payout: ${request.stripe_payout_id}`)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Aprovar Saque" : "Rejeitar Saque"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve"
                ? "Ao aprovar, o pagamento será processado via Stripe para o CPF/CNPJ informado."
                : "Informe o motivo da rejeição para o produtor."}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Produtor</Label>
                  <p className="font-medium">{selectedRequest.producer_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Valor</Label>
                  <p className="font-medium text-lg">
                    R$ {Number(selectedRequest.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">CPF/CNPJ</Label>
                  <p className="font-medium">{selectedRequest.producer_document}</p>
                </div>
              </div>

              {actionType === "reject" && (
                <div className="space-y-2">
                  <Label htmlFor="reason">Motivo da Rejeição</Label>
                  <Textarea
                    id="reason"
                    placeholder="Informe o motivo da rejeição..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                </div>
              )}

              {actionType === "approve" && (
                <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    O pagamento será processado via Stripe Payouts. Certifique-se de que sua conta Stripe tem saldo suficiente.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant={actionType === "approve" ? "default" : "destructive"}
              onClick={handleAction}
              disabled={processing || (actionType === "reject" && !rejectionReason.trim())}
            >
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {actionType === "approve" ? "Aprovar e Processar" : "Rejeitar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminWithdrawals;
