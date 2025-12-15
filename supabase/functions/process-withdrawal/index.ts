import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const { withdrawalId, action, rejectionReason } = await req.json();
    if (!withdrawalId) throw new Error("Withdrawal ID is required");
    if (!action) throw new Error("Action is required (approve, reject, or confirm_transfer)");
    logStep("Processing withdrawal", { withdrawalId, action });

    // Fetch withdrawal request
    const { data: withdrawal, error: withdrawalError } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("*")
      .eq("id", withdrawalId)
      .single();

    if (withdrawalError || !withdrawal) {
      throw new Error("Withdrawal request not found");
    }

    logStep("Withdrawal found", { 
      amount: withdrawal.amount, 
      document: withdrawal.producer_document,
      currentStatus: withdrawal.status 
    });

    // Handle REJECT action
    if (action === "reject") {
      if (withdrawal.status !== "pending") {
        throw new Error("Only pending withdrawals can be rejected");
      }

      const { error: updateError } = await supabaseAdmin
        .from("withdrawal_requests")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason || "Solicitação rejeitada pelo administrador",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", withdrawalId);

      if (updateError) throw updateError;

      // Send rejection notification email
      try {
        await supabaseAdmin.functions.invoke("send-withdrawal-notification", {
          body: { withdrawalId, status: "rejected", rejectionReason },
        });
      } catch (emailError) {
        logStep("Warning: Failed to send rejection email", { error: emailError });
      }

      logStep("Withdrawal rejected");

      return new Response(
        JSON.stringify({ success: true, message: "Solicitação rejeitada com sucesso" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Handle APPROVE action - moves to "awaiting_transfer" status
    if (action === "approve") {
      if (withdrawal.status !== "pending") {
        throw new Error("Only pending withdrawals can be approved");
      }

      const { error: updateError } = await supabaseAdmin
        .from("withdrawal_requests")
        .update({
          status: "awaiting_transfer",
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", withdrawalId);

      if (updateError) throw updateError;

      logStep("Withdrawal approved - awaiting PIX transfer");

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Saque aprovado. Realize a transferência PIX e confirme quando concluído.",
          pixInstructions: {
            key: withdrawal.producer_document,
            amount: withdrawal.amount,
            description: `Saque #${withdrawalId.slice(0, 8)}`,
          }
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Handle CONFIRM_TRANSFER action - marks as completed after PIX was done
    if (action === "confirm_transfer") {
      if (withdrawal.status !== "awaiting_transfer") {
        throw new Error("Only withdrawals awaiting transfer can be confirmed");
      }

      const transferId = `pix_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const { error: updateError } = await supabaseAdmin
        .from("withdrawal_requests")
        .update({
          status: "completed",
          stripe_payout_id: transferId,
        })
        .eq("id", withdrawalId);

      if (updateError) throw updateError;

      // Send completion notification email
      try {
        await supabaseAdmin.functions.invoke("send-withdrawal-notification", {
          body: { withdrawalId, status: "completed" },
        });
      } catch (emailError) {
        logStep("Warning: Failed to send completion email", { error: emailError });
      }

      logStep("Withdrawal completed - PIX transfer confirmed", { transferId });

      return new Response(
        JSON.stringify({ 
          success: true, 
          transferId,
          message: "Transferência PIX confirmada. O produtor foi notificado."
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    throw new Error("Invalid action. Use 'approve', 'reject', or 'confirm_transfer'");

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
