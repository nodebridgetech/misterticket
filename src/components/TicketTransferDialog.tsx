import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, Send, AlertTriangle } from "lucide-react";
import { logActivity } from "@/hooks/useActivityLog";

const emailSchema = z.string().email("E-mail inválido");

interface TicketTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: {
    id: string;
    event_id: string;
    events: {
      title: string;
    };
    tickets: {
      batch_name: string;
    };
    quantity: number;
  };
  onTransferComplete: () => void;
}

export function TicketTransferDialog({
  open,
  onOpenChange,
  sale,
  onTransferComplete,
}: TicketTransferDialogProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);
  const [recipientName, setRecipientName] = useState("");

  const handleClose = () => {
    setEmail("");
    setError(null);
    setConfirmStep(false);
    setRecipientName("");
    onOpenChange(false);
  };

  const handleVerifyEmail = async () => {
    setError(null);

    // Validate email format
    const result = emailSchema.safeParse(email.trim().toLowerCase());
    if (!result.success) {
      setError("Por favor, insira um e-mail válido.");
      return;
    }

    // Check if it's the user's own email
    if (email.trim().toLowerCase() === user?.email?.toLowerCase()) {
      setError("Você não pode transferir o ingresso para você mesmo.");
      return;
    }

    setLoading(true);

    try {
      // Check if email exists in the system
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (profileError) {
        console.error("Error checking email:", profileError);
        setError("Erro ao verificar o e-mail. Tente novamente.");
        return;
      }

      if (!profile) {
        setError("Este e-mail não está cadastrado no sistema. O destinatário precisa criar uma conta primeiro.");
        return;
      }

      setRecipientName(profile.full_name);
      setConfirmStep(true);
    } catch (err) {
      console.error("Error:", err);
      setError("Erro ao processar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get recipient's user_id and name
      const { data: recipientProfile, error: recipientError } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("email", email.trim().toLowerCase())
        .single();

      if (recipientError || !recipientProfile) {
        setError("Erro ao encontrar o destinatário. Tente novamente.");
        return;
      }

      // Get sender profile info
      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", user!.id)
        .single();

      // Create transfer record
      const { error: transferError } = await supabase
        .from("ticket_transfers")
        .insert({
          sale_id: sale.id,
          from_user_id: user!.id,
          to_user_id: recipientProfile.user_id,
          transferred_by: user!.id,
        });

      if (transferError) {
        console.error("Transfer record error:", transferError);
        setError("Erro ao registrar a transferência. Tente novamente.");
        return;
      }

      // Update the sale to new owner
      const { error: updateError } = await supabase
        .from("sales")
        .update({ buyer_id: recipientProfile.user_id })
        .eq("id", sale.id);

      if (updateError) {
        console.error("Update sale error:", updateError);
        setError("Erro ao transferir o ingresso. Tente novamente.");
        return;
      }

      // Log activity for ticket transfer
      await logActivity({
        actionType: "update",
        entityType: "ticket",
        entityId: sale.id,
        entityName: `${sale.events.title} - ${sale.tickets.batch_name}`,
        details: {
          action: "transfer",
          from_user: senderProfile?.full_name || user?.email,
          to_user: recipientProfile.full_name,
          to_email: recipientProfile.email,
          quantity: sale.quantity,
        },
      });

      // Send notification emails via edge function
      try {
        await supabase.functions.invoke("send-transfer-notification", {
          body: {
            senderName: senderProfile?.full_name || "Usuário",
            senderEmail: senderProfile?.email || user?.email,
            recipientName: recipientProfile.full_name,
            recipientEmail: recipientProfile.email,
            eventTitle: sale.events.title,
            ticketBatch: sale.tickets.batch_name,
            quantity: sale.quantity,
          },
        });
        console.log("Transfer notification emails sent");
      } catch (emailError) {
        console.error("Failed to send notification emails:", emailError);
        // Don't block the transfer if email fails
      }

      toast.success("Ingresso transferido com sucesso!");
      onTransferComplete();
      handleClose();
    } catch (err) {
      console.error("Error:", err);
      setError("Erro ao processar a transferência. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Transferir Ingresso
          </DialogTitle>
          <DialogDescription>
            Transfira este ingresso para outra pessoa cadastrada no sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-lg text-sm">
            <p className="font-medium">{sale.events.title}</p>
            <p className="text-muted-foreground">
              {sale.tickets.batch_name} • {sale.quantity} ingresso(s)
            </p>
          </div>

          {!confirmStep ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail do destinatário</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  O destinatário precisa ter uma conta cadastrada no sistema.
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </>
          ) : (
            <>
              <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                  <strong>Atenção:</strong> Esta ação é irreversível. O ingresso será transferido para{" "}
                  <strong>{recipientName}</strong> ({email}) e não aparecerá mais na sua conta.
                </AlertDescription>
              </Alert>

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          
          {!confirmStep ? (
            <Button onClick={handleVerifyEmail} disabled={loading || !email.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verificar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmStep(false);
                  setError(null);
                }}
                disabled={loading}
              >
                Voltar
              </Button>
              <Button onClick={handleTransfer} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Transferência
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
