import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ProducerApprovalTabProps {
  producerRequests: any[];
  onRefresh: () => void;
}

export const ProducerApprovalTab = ({ producerRequests, onRefresh }: ProducerApprovalTabProps) => {
  const { toast } = useToast();
  const [processing, setProcessing] = useState<string | null>(null);

  const handleApproval = async (requestId: string, approve: boolean) => {
    setProcessing(requestId);
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({
          is_approved: approve,
          approved_at: approve ? new Date().toISOString() : null,
        })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: approve ? "Produtor aprovado!" : "Solicitação rejeitada",
        description: approve
          ? "O produtor agora pode criar eventos."
          : "A solicitação foi rejeitada.",
      });

      onRefresh();
    } catch (error) {
      console.error("Error processing request:", error);
      toast({
        title: "Erro",
        description: "Não foi possível processar a solicitação.",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Solicitações de Produtores</CardTitle>
        <CardDescription>
          Aprove ou rejeite solicitações para se tornar produtor
        </CardDescription>
      </CardHeader>
      <CardContent>
        {producerRequests.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhuma solicitação pendente
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome do Produtor</TableHead>
                <TableHead>Data da Solicitação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {producerRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">
                    {request.profiles?.full_name || "Nome não disponível"}
                  </TableCell>
                  <TableCell>
                    {format(new Date(request.requested_at), "dd/MM/yyyy HH:mm")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">Pendente</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleApproval(request.id, true)}
                      disabled={processing === request.id}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleApproval(request.id, false)}
                      disabled={processing === request.id}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Rejeitar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
