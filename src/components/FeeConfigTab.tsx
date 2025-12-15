import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const FeeConfigTab = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    platform_fee_value: "10.00",
    platform_fee_type: "percentage" as "percentage" | "fixed",
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
          platform_fee_value: data.platform_fee_value?.toString() || "10.00",
          platform_fee_type: (data.platform_fee_type as "percentage" | "fixed") || "percentage",
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
      // Validate
      const feeValue = parseFloat(config.platform_fee_value);
      if (feeValue < 0) {
        toast({
          title: "Valor inválido",
          description: "A taxa não pode ser negativa.",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }
      
      if (config.platform_fee_type === "percentage" && feeValue > 100) {
        toast({
          title: "Valor inválido",
          description: "A porcentagem deve estar entre 0 e 100%.",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      // Desativar configurações antigas
      await supabase
        .from("fee_config")
        .update({ is_active: false })
        .eq("is_active", true);

      // Inserir nova configuração
      const { error } = await supabase
        .from("fee_config")
        .insert({
          platform_fee_value: feeValue,
          platform_fee_type: config.platform_fee_type,
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
            <Label>Tipo de Taxa da Plataforma</Label>
            <Select 
              value={config.platform_fee_type} 
              onValueChange={(v) => setConfig({ ...config, platform_fee_type: v as "percentage" | "fixed" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                <SelectItem value="fixed">Valor Fixo (R$ por ingresso)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Escolha como a taxa será calculada
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="platform_fee">
              {config.platform_fee_type === "percentage" ? "Taxa da Plataforma (%)" : "Taxa da Plataforma (R$)"}
            </Label>
            <Input
              id="platform_fee"
              type="number"
              step="0.01"
              min="0"
              max={config.platform_fee_type === "percentage" ? 100 : undefined}
              value={config.platform_fee_value}
              onChange={(e) =>
                setConfig({ ...config, platform_fee_value: e.target.value })
              }
            />
            <p className="text-sm text-muted-foreground">
              {config.platform_fee_type === "percentage" 
                ? "Percentual cobrado pela plataforma em cada venda"
                : "Valor fixo cobrado por ingresso vendido"
              }
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