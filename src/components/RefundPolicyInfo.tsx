import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

export function RefundPolicyInfo() {
  const [policyText, setPolicyText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPolicy = async () => {
      const { data, error } = await supabase
        .from("refund_policy_config")
        .select("policy_text")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setPolicyText(data.policy_text);
      }
      setLoading(false);
    };

    fetchPolicy();
  }, []);

  if (loading || !policyText) {
    return null;
  }

  return (
    <Alert className="border-blue-500/30 bg-blue-50 dark:bg-blue-950/30">
      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      <AlertDescription className="text-blue-800 dark:text-blue-200">
        <strong className="font-medium">Cancelamentos e Reembolsos:</strong>{" "}
        {policyText}
      </AlertDescription>
    </Alert>
  );
}
