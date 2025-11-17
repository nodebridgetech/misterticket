import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PurchaseConfirmationRequest {
  email: string;
  userName: string;
  eventTitle: string;
  eventDate: string;
  eventVenue: string;
  ticketType: string;
  quantity: number;
  totalPrice: number;
  qrCodes: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      email, 
      userName, 
      eventTitle, 
      eventDate, 
      eventVenue,
      ticketType,
      quantity,
      totalPrice,
      qrCodes 
    }: PurchaseConfirmationRequest = await req.json();

    console.log("Sending purchase confirmation to:", email);

    const qrCodesHtml = qrCodes.map((qrCode, index) => `
      <div style="margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
        <h3 style="margin: 0 0 10px 0; color: #333;">Ingresso ${index + 1}</h3>
        <img src="${qrCode}" alt="QR Code ${index + 1}" style="max-width: 200px; height: auto;" />
        <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">Apresente este QR Code na entrada do evento</p>
      </div>
    `).join('');

    const emailResponse = await resend.emails.send({
      from: "Mister Ticket <no-reply@mailing.misterticket.com.br>",
      to: [email],
      subject: `Confirmação de Compra - ${eventTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Compra Confirmada! 🎉</h1>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <p style="font-size: 16px; margin-bottom: 20px;">Olá <strong>${userName}</strong>,</p>
              
              <p style="font-size: 16px; margin-bottom: 20px;">Sua compra foi confirmada com sucesso! Segue os detalhes do seu pedido:</p>
              
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="margin: 0 0 15px 0; color: #667eea; font-size: 20px;">${eventTitle}</h2>
                <p style="margin: 5px 0; color: #666;"><strong>Data:</strong> ${eventDate}</p>
                <p style="margin: 5px 0; color: #666;"><strong>Local:</strong> ${eventVenue}</p>
                <p style="margin: 5px 0; color: #666;"><strong>Tipo de Ingresso:</strong> ${ticketType}</p>
                <p style="margin: 5px 0; color: #666;"><strong>Quantidade:</strong> ${quantity} ingresso(s)</p>
                <p style="margin: 5px 0; color: #666;"><strong>Valor Total:</strong> R$ ${totalPrice.toFixed(2)}</p>
              </div>

              <h2 style="color: #667eea; font-size: 20px; margin-bottom: 15px;">Seus Ingressos</h2>
              <p style="font-size: 14px; color: #666; margin-bottom: 20px;">Guarde bem estes QR Codes. Você precisará apresentá-los na entrada do evento.</p>
              
              ${qrCodesHtml}

              <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-top: 20px; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #856404;">
                  <strong>Importante:</strong> Cada QR Code é único e válido para uma única entrada. Não compartilhe seus QR Codes com outras pessoas.
                </p>
              </div>

              <p style="margin-top: 30px; font-size: 14px; color: #666;">
                Aproveite o evento! 🎊
              </p>

              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
              
              <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
                Este é um e-mail automático. Por favor, não responda.<br>
                © ${new Date().getFullYear()} Mister Ticket. Todos os direitos reservados.
              </p>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Purchase confirmation sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-purchase-confirmation function:", error);
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
