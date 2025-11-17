import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("User not authenticated");
    }

    // Validate session ID
    const requestSchema = z.object({
      sessionId: z.string().min(1, "Session ID is required"),
    });

    const requestData = await req.json();
    const validation = requestSchema.safeParse(requestData);
    
    if (!validation.success) {
      const errorMessage = validation.error.errors.map(e => e.message).join(", ");
      throw new Error(`Invalid request data: ${errorMessage}`);
    }

    const { sessionId } = validation.data;
    logStep("Verifying session", { sessionId, authenticatedUser: userData.user.id });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      throw new Error("Session not found");
    }

    logStep("Session retrieved", { status: session.payment_status });

    if (session.payment_status !== "paid") {
      return new Response(
        JSON.stringify({ 
          success: false, 
          status: session.payment_status 
        }), 
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Extract metadata
    const metadata = session.metadata || {};
    const eventId = metadata.eventId;
    const ticketId = metadata.ticketId;
    const quantity = parseInt(metadata.quantity || "1");
    const platformFee = parseFloat(metadata.platformFee || "0");
    const gatewayFee = parseFloat(metadata.gatewayFee || "0");
    const producerAmount = parseFloat(metadata.producerAmount || "0");
    const userId = metadata.userId;

    // SECURITY: Verify user ID matches authenticated user
    if (userId !== userData.user.id) {
      logStep("Security violation: User ID mismatch", { 
        metadataUserId: userId, 
        authenticatedUserId: userData.user.id 
      });
      throw new Error("User ID mismatch - potential security issue");
    }

    // SECURITY: Verify session customer matches if available
    if (session.customer && metadata.stripeCustomerId && session.customer !== metadata.stripeCustomerId) {
      logStep("Security violation: Customer ID mismatch", {
        sessionCustomer: session.customer,
        metadataCustomer: metadata.stripeCustomerId
      });
      throw new Error("Session customer mismatch");
    }

    logStep("Security checks passed", { userId });

    // Check if sale already exists
    const { data: existingSale } = await supabaseClient
      .from("sales")
      .select("id")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (existingSale) {
      logStep("Sale already recorded", { saleId: existingSale.id });
      return new Response(
        JSON.stringify({ 
          success: true, 
          alreadyRecorded: true,
          saleId: existingSale.id
        }), 
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Get ticket price
    const { data: ticket } = await supabaseClient
      .from("tickets")
      .select("price")
      .eq("id", ticketId)
      .single();

    const unitPrice = ticket ? Number(ticket.price) : 0;
    const totalPrice = unitPrice * quantity + platformFee + gatewayFee;

    // Create individual sales records for each ticket
    const salesToInsert = [];
    const qrCodes = [];
    
    for (let i = 0; i < quantity; i++) {
      // SECURITY: Generate cryptographically secure random token for QR code
      const tokenBytes = new Uint8Array(32);
      crypto.getRandomValues(tokenBytes);
      const qrToken = btoa(String.fromCharCode(...tokenBytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      
      // Create QR code URL with just the secure token
      const qrCodeData = JSON.stringify({
        token: qrToken,
        eventId: eventId
      });
      const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeData)}`;
      qrCodes.push(qrCode);
      
      salesToInsert.push({
        buyer_id: userId,
        event_id: eventId,
        ticket_id: ticketId,
        quantity: 1, // Each record represents 1 ticket
        unit_price: unitPrice,
        total_price: unitPrice + (platformFee / quantity) + (gatewayFee / quantity),
        platform_fee: platformFee / quantity,
        gateway_fee: gatewayFee / quantity,
        producer_amount: producerAmount / quantity,
        payment_status: "paid",
        stripe_payment_intent_id: session.payment_intent as string,
        stripe_customer_id: session.customer as string,
        stripe_session_id: sessionId,
        qr_code: qrCode,
        qr_token: qrToken,
      });
    }

    // Insert all sales records
    const { data: sales, error: saleError } = await supabaseClient
      .from("sales")
      .insert(salesToInsert)
      .select();

    if (saleError) {
      logStep("Error creating sales", { error: saleError });
      throw new Error(`Failed to create sales: ${saleError.message}`);
    }

    // Update ticket quantity sold (increment, not replace)
    const { error: updateError } = await supabaseClient.rpc('increment_ticket_sold', {
      ticket_id: ticketId,
      quantity_increment: quantity
    });

    if (updateError) {
      logStep("Error updating ticket quantity", { error: updateError });
    } else {
      logStep("Ticket quantity updated", { ticketId, quantityAdded: quantity });
    }

    logStep("Sales created successfully", { count: sales.length, saleIds: sales.map(s => s.id) });

    // Get event and user details for email
    const { data: event } = await supabaseClient
      .from("events")
      .select("title, event_date, venue")
      .eq("id", eventId)
      .single();

    const { data: userProfile } = await supabaseClient
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", userId)
      .single();

    // Send purchase confirmation email
    if (event && userProfile && userProfile.email) {
      try {
        await supabaseClient.functions.invoke('send-purchase-confirmation', {
          body: {
            email: userProfile.email,
            userName: userProfile.full_name,
            eventTitle: event.title,
            eventDate: new Date(event.event_date).toLocaleDateString('pt-BR'),
            eventVenue: event.venue,
            ticketType: metadata.ticketName || 'Ingresso',
            quantity: quantity,
            totalPrice: totalPrice,
            qrCodes: qrCodes
          }
        });
        logStep("Purchase confirmation email sent");
      } catch (emailError) {
        logStep("Error sending purchase confirmation email", { error: emailError });
        // Don't fail the whole transaction if email fails
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sales: sales.map(s => ({ saleId: s.id, qrCode: s.qr_code })),
        qrCodes: qrCodes
      }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in verify-payment", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ error: errorMessage }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
