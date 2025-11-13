import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  name: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name }: WelcomeEmailRequest = await req.json();

    console.log("Sending welcome email to:", email);

    // Sanitize name to prevent XSS in email template
    const escapeHtml = (str: string) => 
      str.replace(/[&<>"']/g, (char) => {
        const entities: Record<string, string> = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        };
        return entities[char];
      });

    const sanitizedName = escapeHtml(name);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Bem-vindo ao Mister Ticket</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #F5A623 0%, #E89C1F 100%); padding: 40px 30px; text-align: center;">
                      <div style="margin-bottom: 20px;">
                        <img src="https://txkwnrrhaahhhpmjjbyl.supabase.co/storage/v1/object/public/event-images/mister-ticket-logo.png" alt="Mister Ticket" style="max-width: 300px; height: auto;">
                      </div>
                      <h1 style="color: #ffffff; margin: 0 0 10px 0; font-size: 28px; font-weight: bold;">🎉 Bem-vindo!</h1>
                      <p style="color: #FFF8E7; margin: 0; font-size: 16px;">Sua porta de entrada para os melhores eventos</p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <h2 style="color: #1A1F2C; margin: 0 0 20px 0; font-size: 24px;">Olá, ${sanitizedName}! 👋</h2>
                      <p style="color: #403E43; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
                        Que bom ter você por aqui! Sua conta foi criada com sucesso e você já pode começar a explorar os eventos mais incríveis da sua região.
                      </p>
                      
                      <!-- Features -->
                      <div style="background-color: #F6F6F7; border-radius: 8px; padding: 20px; margin: 30px 0;">
                        <h3 style="color: #1A1F2C; margin: 0 0 15px 0; font-size: 18px;">O que você pode fazer agora:</h3>
                        <ul style="color: #403E43; margin: 0; padding-left: 20px; line-height: 1.8;">
                          <li style="margin-bottom: 10px;">🎫 Comprar ingressos para shows, festas e eventos</li>
                          <li style="margin-bottom: 10px;">🎪 Descobrir novos eventos na sua cidade</li>
                          <li style="margin-bottom: 10px;">💳 Pagamento rápido e seguro via Stripe</li>
                          <li>📱 Gerenciar seus ingressos em um só lugar</li>
                        </ul>
                      </div>
                      
                      <!-- Button -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                        <tr>
                          <td align="center">
                            <a href="https://misterticket.com.br/eventos" style="display: inline-block; background: linear-gradient(135deg, #F5A623 0%, #E89C1F 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                              Explorar Eventos
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="color: #403E43; margin: 30px 0 0 0; font-size: 16px; line-height: 1.6;">
                        Estamos sempre adicionando novos eventos. Fique de olho nas nossas novidades!
                      </p>
                      
                      <p style="color: #403E43; margin: 20px 0 0 0; font-size: 16px; line-height: 1.6;">
                        Abraços,<br>
                        <strong style="color: #F5A623;">Equipe Mister Ticket</strong>
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #F6F6F7; padding: 30px; text-align: center; border-top: 1px solid #FFE4B3;">
                      <p style="color: #8E9196; margin: 0 0 10px 0; font-size: 14px;">
                        Precisa de ajuda? Entre em contato conosco!
                      </p>
                      <p style="color: #8E9196; margin: 0; font-size: 14px;">
                        © ${new Date().getFullYear()} Mister Ticket. Todos os direitos reservados.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Mister Ticket <no-reply@mailing.misterticket.com.br>",
      to: [email],
      subject: "🎉 Bem-vindo ao Mister Ticket!",
      html: html,
    });

    console.log("Welcome email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
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
