import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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

    const { sessionId } = await req.json();
    
    if (!sessionId) {
      throw new Error("Missing sessionId");
    }

    logStep("Verifying session", { sessionId });

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

    // Generate QR code as image URL using public QR code API
    const qrCodeData = JSON.stringify({
      saleId: sessionId,
      eventId,
      ticketId,
      quantity,
      userId,
      timestamp: Date.now()
    });
    const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeData)}`;

    // Create sale record
    const { data: sale, error: saleError } = await supabaseClient
      .from("sales")
      .insert({
        buyer_id: userId,
        event_id: eventId,
        ticket_id: ticketId,
        quantity: quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
        platform_fee: platformFee,
        gateway_fee: gatewayFee,
        producer_amount: producerAmount,
        payment_status: "paid",
        stripe_payment_intent_id: session.payment_intent as string,
        stripe_customer_id: session.customer as string,
        stripe_session_id: sessionId,
        qr_code: qrCode,
      })
      .select()
      .single();

    if (saleError) {
      logStep("Error creating sale", { error: saleError });
      throw new Error(`Failed to create sale: ${saleError.message}`);
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

    logStep("Sale created successfully", { saleId: sale.id });

    return new Response(
      JSON.stringify({ 
        success: true, 
        saleId: sale.id,
        qrCode: qrCode
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
