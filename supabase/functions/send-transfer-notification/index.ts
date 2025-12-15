import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TransferNotificationRequest {
  senderName: string;
  senderEmail: string;
  recipientName: string;
  recipientEmail: string;
  eventTitle: string;
  ticketBatch: string;
  quantity: number;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      senderName,
      senderEmail,
      recipientName,
      recipientEmail,
      eventTitle,
      ticketBatch,
      quantity,
    }: TransferNotificationRequest = await req.json();

    console.log("Sending transfer notification emails...");
    console.log("From:", senderEmail, "To:", recipientEmail);

    // Email to the sender (who transferred the ticket)
    const senderEmailResponse = await resend.emails.send({
      from: "Mister Ticket <noreply@misterticket.com.br>",
      to: [senderEmail],
      subject: `Ingresso transferido com sucesso - ${eventTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #7c3aed; margin: 0;">Mister Ticket</h1>
          </div>
          
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h2 style="margin-top: 0; color: #333;">Transferência realizada com sucesso!</h2>
            
            <p>Olá, <strong>${senderName}</strong>!</p>
            
            <p>Confirmamos que seu ingresso foi transferido com sucesso.</p>
            
            <div style="background-color: #fff; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #7c3aed;">
              <p style="margin: 5px 0;"><strong>Evento:</strong> ${eventTitle}</p>
              <p style="margin: 5px 0;"><strong>Lote:</strong> ${ticketBatch}</p>
              <p style="margin: 5px 0;"><strong>Quantidade:</strong> ${quantity} ingresso(s)</p>
              <p style="margin: 5px 0;"><strong>Transferido para:</strong> ${recipientName} (${recipientEmail})</p>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              Este ingresso não aparecerá mais na sua conta. O destinatário agora poderá acessá-lo em sua própria conta.
            </p>
          </div>
          
          <div style="text-align: center; color: #888; font-size: 12px; margin-top: 30px;">
            <p>Este é um email automático. Por favor, não responda.</p>
            <p>&copy; ${new Date().getFullYear()} Mister Ticket. Todos os direitos reservados.</p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Sender email sent:", senderEmailResponse);

    // Email to the recipient (who received the ticket)
    const recipientEmailResponse = await resend.emails.send({
      from: "Mister Ticket <noreply@misterticket.com.br>",
      to: [recipientEmail],
      subject: `Você recebeu um ingresso! - ${eventTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #7c3aed; margin: 0;">Mister Ticket</h1>
          </div>
          
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h2 style="margin-top: 0; color: #333;">🎉 Você recebeu um ingresso!</h2>
            
            <p>Olá, <strong>${recipientName}</strong>!</p>
            
            <p><strong>${senderName}</strong> transferiu um ingresso para você.</p>
            
            <div style="background-color: #fff; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #22c55e;">
              <p style="margin: 5px 0;"><strong>Evento:</strong> ${eventTitle}</p>
              <p style="margin: 5px 0;"><strong>Lote:</strong> ${ticketBatch}</p>
              <p style="margin: 5px 0;"><strong>Quantidade:</strong> ${quantity} ingresso(s)</p>
            </div>
            
            <p>Acesse sua conta no Mister Ticket para visualizar o ingresso e o QR Code de entrada.</p>
            
            <div style="text-align: center; margin: 25px 0;">
              <a href="https://misterticket.com.br/minha-conta" 
                 style="background-color: #7c3aed; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Ver meus ingressos
              </a>
            </div>
          </div>
          
          <div style="text-align: center; color: #888; font-size: 12px; margin-top: 30px;">
            <p>Este é um email automático. Por favor, não responda.</p>
            <p>&copy; ${new Date().getFullYear()} Mister Ticket. Todos os direitos reservados.</p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Recipient email sent:", recipientEmailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        senderEmail: senderEmailResponse,
        recipientEmail: recipientEmailResponse 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending transfer notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
