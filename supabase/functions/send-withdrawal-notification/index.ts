import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SEND-WITHDRAWAL-NOTIFICATION] ${step}${detailsStr}`);
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

    const { withdrawalId, status, rejectionReason } = await req.json();
    
    if (!withdrawalId || !status) {
      throw new Error("withdrawalId and status are required");
    }

    logStep("Processing notification", { withdrawalId, status });

    // Fetch withdrawal request
    const { data: withdrawal, error: withdrawalError } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("*")
      .eq("id", withdrawalId)
      .single();

    if (withdrawalError || !withdrawal) {
      throw new Error("Withdrawal request not found");
    }

    // Fetch producer profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", withdrawal.producer_id)
      .single();

    if (profileError || !profile || !profile.email) {
      throw new Error("Producer profile not found or email not available");
    }

    logStep("Found producer", { email: profile.email, name: profile.full_name });

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const amount = Number(withdrawal.amount).toLocaleString('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    });

    let subject: string;
    let htmlContent: string;

    if (status === "completed" || status === "approved") {
      subject = "✅ Saque aprovado - Mister Ticket";
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981, #059669); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .highlight { background: #dcfce7; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
            .amount { font-size: 32px; font-weight: bold; color: #059669; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Saque Aprovado! 🎉</h1>
            </div>
            <div class="content">
              <p>Olá, <strong>${profile.full_name}</strong>!</p>
              <p>Ótimas notícias! Seu saque foi aprovado e está sendo processado.</p>
              
              <div class="highlight">
                <p style="margin: 0 0 10px 0; color: #6b7280;">Valor do saque:</p>
                <p class="amount">${amount}</p>
              </div>
              
              <p>O valor será transferido via PIX para o CPF/CNPJ cadastrado: <strong>${withdrawal.producer_document}</strong></p>
              <p>O pagamento deve ser processado em até 24 horas úteis.</p>
              
              <div class="footer">
                <p>Mister Ticket - Sua plataforma de eventos</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
    } else if (status === "rejected") {
      subject = "❌ Saque rejeitado - Mister Ticket";
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ef4444, #dc2626); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .highlight { background: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .amount { font-size: 24px; font-weight: bold; color: #dc2626; }
            .reason { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Saque Rejeitado</h1>
            </div>
            <div class="content">
              <p>Olá, <strong>${profile.full_name}</strong>!</p>
              <p>Infelizmente, sua solicitação de saque foi rejeitada.</p>
              
              <div class="highlight">
                <p style="margin: 0 0 10px 0; color: #6b7280;">Valor solicitado:</p>
                <p class="amount">${amount}</p>
              </div>
              
              ${rejectionReason ? `
              <div class="reason">
                <p style="margin: 0 0 5px 0; font-weight: bold;">Motivo da rejeição:</p>
                <p style="margin: 0;">${rejectionReason}</p>
              </div>
              ` : ''}
              
              <p>O valor permanece em seu saldo disponível para futuras solicitações.</p>
              <p>Se você tiver dúvidas, entre em contato com nosso suporte.</p>
              
              <div class="footer">
                <p>Mister Ticket - Sua plataforma de eventos</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      throw new Error(`Invalid status: ${status}`);
    }

    // Send email via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Mister Ticket <noreply@misterticket.com.br>",
        to: [profile.email],
        subject,
        html: htmlContent,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(`Failed to send email: ${errorText}`);
    }

    logStep("Email sent successfully");

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
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