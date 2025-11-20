import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export const FeeConfigTab = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    platform_fee_percentage: "10.00",
    payment_gateway_fee_percentage: "3.00",
    min_withdrawal_amount: "50.00",
  });

  useEffect(() => {
    fetchFeeConfig();
  }, []);

  const fetchFeeConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("fee_config")
        .select("*")
        .eq("is_active", true)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setConfig({
          platform_fee_percentage: data.platform_fee_percentage?.toString() || "10.00",
          payment_gateway_fee_percentage: data.payment_gateway_fee_percentage?.toString() || "3.00",
          min_withdrawal_amount: data.min_withdrawal_amount?.toString() || "50.00",
        });
      }
    } catch (error) {
      console.error("Error fetching fee config:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Desativar configurações antigas
      await supabase
        .from("fee_config")
        .update({ is_active: false })
        .eq("is_active", true);

      // Inserir nova configuração
      const { error } = await supabase
        .from("fee_config")
        .insert({
          platform_fee_percentage: parseFloat(config.platform_fee_percentage),
          payment_gateway_fee_percentage: parseFloat(config.payment_gateway_fee_percentage),
          min_withdrawal_amount: parseFloat(config.min_withdrawal_amount),
          is_active: true,
        });

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Configurações de taxas atualizadas.",
      });
    } catch (error) {
      console.error("Error saving fee config:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuração de Taxas</CardTitle>
        <CardDescription>
          Configure as taxas da plataforma e do gateway de pagamento
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="platform_fee">Taxa da Plataforma (%)</Label>
            <Input
              id="platform_fee"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={config.platform_fee_percentage}
              onChange={(e) =>
                setConfig({ ...config, platform_fee_percentage: e.target.value })
              }
            />
            <p className="text-sm text-muted-foreground">
              Percentual cobrado pela plataforma em cada venda
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gateway_fee">Taxa de Processamento (%)</Label>
            <Input
              id="gateway_fee"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={config.payment_gateway_fee_percentage}
              onChange={(e) =>
                setConfig({ ...config, payment_gateway_fee_percentage: e.target.value })
              }
            />
            <p className="text-sm text-muted-foreground">
              Percentual cobrado pelo gateway de pagamento
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="min_withdrawal">Valor Mínimo para Saque (R$)</Label>
            <Input
              id="min_withdrawal"
              type="number"
              step="0.01"
              min="0"
              value={config.min_withdrawal_amount}
              onChange={(e) =>
                setConfig({ ...config, min_withdrawal_amount: e.target.value })
              }
            />
            <p className="text-sm text-muted-foreground">
              Valor mínimo que produtores podem sacar
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Configurações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
