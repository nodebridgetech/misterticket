import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Create Supabase admin client
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: PasswordResetRequest = await req.json();

    console.log("Generating password reset link for:", email);

    // Generate the reset link using Supabase Admin API
    const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${Deno.env.get("VITE_SUPABASE_URL") || "https://misterticket.com.br"}/redefinir-senha`
      }
    });

    if (linkError) {
      console.error("Error generating reset link:", linkError);
      throw linkError;
    }

    if (!data?.properties?.action_link) {
      throw new Error("Failed to generate reset link");
    }

    const resetLink = data.properties.action_link;
    console.log("Sending password reset email to:", email);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Redefinir Senha - Mister Ticket</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #F5A623 0%, #E89C1F 100%); padding: 40px 30px; text-align: center;">
                      <div style="margin-bottom: 15px;">
                        <img src="https://txkwnrrhaahhhpmjjbyl.supabase.co/storage/v1/object/public/event-images/mister-ticket-logo.png" alt="Mister Ticket" style="max-width: 280px; height: auto;">
                      </div>
                      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">Redefinir Senha</h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <h2 style="color: #1A1F2C; margin: 0 0 20px 0; font-size: 24px;">Redefinir sua senha</h2>
                      <p style="color: #403E43; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
                        Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha:
                      </p>
                      
                      <!-- Button -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                        <tr>
                          <td align="center">
                            <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #F5A623 0%, #E89C1F 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                              Redefinir Senha
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="color: #8E9196; margin: 20px 0 0 0; font-size: 14px; line-height: 1.6;">
                        Ou copie e cole este link no seu navegador:
                      </p>
                      <p style="color: #F5A623; margin: 10px 0 0 0; font-size: 14px; word-break: break-all;">
                        ${resetLink}
                      </p>
                      
                      <hr style="border: none; border-top: 1px solid #FFE4B3; margin: 30px 0;">
                      
                      <p style="color: #8E9196; margin: 0; font-size: 14px; line-height: 1.6;">
                        Se você não solicitou a redefinição de senha, pode ignorar este email com segurança. Sua senha não será alterada.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #F6F6F7; padding: 30px; text-align: center;">
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
      subject: "Redefinir sua senha - Mister Ticket",
      html: html,
    });

    console.log("Password reset email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-password-reset function:", error);
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
