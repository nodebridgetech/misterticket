import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PROCESS-WITHDRAWAL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    // Verify admin authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role, is_approved")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .eq("is_approved", true)
      .single();

    if (!roleData) throw new Error("Unauthorized: Admin access required");
    logStep("Admin verified", { userId: user.id });

    // Get request body
    const { withdrawalId } = await req.json();
    if (!withdrawalId) throw new Error("Withdrawal ID is required");
    logStep("Processing withdrawal", { withdrawalId });

    // Fetch withdrawal request
    const { data: withdrawal, error: withdrawalError } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("*")
      .eq("id", withdrawalId)
      .single();

    if (withdrawalError || !withdrawal) {
      throw new Error("Withdrawal request not found");
    }

    if (withdrawal.status !== "pending") {
      throw new Error("Withdrawal request is not pending");
    }

    logStep("Withdrawal found", { amount: withdrawal.amount, document: withdrawal.producer_document });

    // Update status to processing
    await supabaseAdmin
      .from("withdrawal_requests")
      .update({ status: "processing" })
      .eq("id", withdrawalId);

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Convert amount to cents (Stripe uses minor units)
    const amountInCents = Math.round(Number(withdrawal.amount) * 100);
    logStep("Creating payout", { amountInCents });

    try {
      // Note: This creates a payout from the Stripe balance to the platform's bank account
      // For sending money to third parties (producers), you would typically use:
      // 1. Stripe Connect with transfers to connected accounts, or
      // 2. Stripe Global Payouts for direct bank transfers
      // 
      // Since Global Payouts and Connect require additional setup,
      // this implementation creates a payout record and marks it for manual processing
      // or can be extended to use Stripe Connect/Global Payouts when available.

      // For now, we'll simulate a successful payout and mark it complete
      // In production, you would integrate with Stripe Connect or Global Payouts
      
      const payoutId = `manual_payout_${Date.now()}`;
      
      // Update withdrawal request with success
      const { error: updateError } = await supabaseAdmin
        .from("withdrawal_requests")
        .update({
          status: "completed",
          stripe_payout_id: payoutId,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", withdrawalId);

      if (updateError) throw updateError;

      logStep("Withdrawal completed", { payoutId });

      return new Response(
        JSON.stringify({ 
          success: true, 
          payoutId,
          message: "Saque aprovado e marcado como concluído. Execute a transferência manualmente via PIX para o CPF/CNPJ informado."
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } catch (stripeError: any) {
      logStep("Stripe error", { error: stripeError.message });

      // Update withdrawal request with failure
      await supabaseAdmin
        .from("withdrawal_requests")
        .update({
          status: "failed",
          rejection_reason: `Erro no processamento: ${stripeError.message}`,
        })
        .eq("id", withdrawalId);

      throw new Error(`Erro ao processar pagamento: ${stripeError.message}`);
    }
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
