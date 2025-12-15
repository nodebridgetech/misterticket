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
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError) {
      throw new Error(`Authentication error: ${userError.message}`);
    }
    
    const user = userData.user;
    if (!user?.email) {
      throw new Error("User not authenticated or email not available");
    }
    
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Validate request data
    const requestSchema = z.object({
      eventId: z.string().uuid("Invalid event ID"),
      ticketId: z.string().uuid("Invalid ticket ID"),
      quantity: z.number().int("Quantity must be an integer").min(1, "Quantity must be at least 1").max(10, "Maximum 10 tickets per purchase"),
    });

    const requestData = await req.json();
    const validation = requestSchema.safeParse(requestData);
    
    if (!validation.success) {
      const errorMessage = validation.error.errors.map(e => e.message).join(", ");
      logStep("Validation failed", { errors: validation.error.errors });
      throw new Error(`Invalid request data: ${errorMessage}`);
    }

    const { eventId, ticketId, quantity } = validation.data;
    logStep("Request data validated", { eventId, ticketId, quantity });

    // Fetch event and ticket details
    const { data: event, error: eventError } = await supabaseClient
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      throw new Error("Event not found");
    }

    const { data: ticket, error: ticketError } = await supabaseClient
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new Error("Ticket not found");
    }

    // Check ticket availability
    const available = ticket.quantity_total - ticket.quantity_sold;
    if (available < quantity) {
      throw new Error(`Only ${available} tickets available`);
    }

    // Check sale period
    const now = new Date();
    const saleStart = new Date(ticket.sale_start_date);
    const saleEnd = new Date(ticket.sale_end_date);
    
    if (now < saleStart || now > saleEnd) {
      throw new Error("Ticket sales are not active for this batch");
    }

    logStep("Event and ticket validated", { event: event.title, ticket: ticket.batch_name });

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if Stripe customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing Stripe customer found", { customerId });
    } else {
      logStep("No existing customer, will create on checkout");
    }

    // Get fee configuration
    const { data: feeConfig } = await supabaseClient
      .from("fee_config")
      .select("*")
      .eq("is_active", true)
      .single();

    // Check for producer custom fee
    const { data: producerCustomFee } = await supabaseClient
      .from("producer_custom_fees")
      .select("fee_value, fee_type")
      .eq("producer_id", event.producer_id)
      .eq("is_active", true)
      .single();

    const gatewayFeePercentage = feeConfig?.payment_gateway_fee_percentage || 3;

    // Calculate amounts
    const ticketPrice = Number(ticket.price);
    const subtotal = ticketPrice * quantity;
    
    // Calculate platform fee based on custom fee or default
    let platformFee: number;
    let platformFeePercentage: number | null = null;
    
    if (producerCustomFee) {
      // Producer has custom fee - DO NOT use default system fee
      if (producerCustomFee.fee_type === "percentage") {
        platformFeePercentage = Number(producerCustomFee.fee_value);
        platformFee = subtotal * (platformFeePercentage / 100);
        logStep("Using custom percentage fee", { percentage: platformFeePercentage });
      } else {
        // Fixed fee per ticket
        platformFee = Number(producerCustomFee.fee_value) * quantity;
        logStep("Using custom fixed fee", { fixedPerTicket: producerCustomFee.fee_value, quantity, total: platformFee });
      }
    } else {
      // No custom fee - use default system fee
      const defaultPercentage = feeConfig?.platform_fee_percentage ?? 10;
      platformFeePercentage = defaultPercentage;
      platformFee = subtotal * (defaultPercentage / 100);
      logStep("Using default system fee", { percentage: defaultPercentage });
    }
    
    const gatewayFee = subtotal * (gatewayFeePercentage / 100);
    const totalAmount = subtotal + platformFee + gatewayFee;

    logStep("Amount calculation", { 
      subtotal, 
      platformFee,
      platformFeePercentage,
      hasCustomFee: !!producerCustomFee,
      customFeeType: producerCustomFee?.fee_type,
      gatewayFee, 
      totalAmount 
    });

    logStep("Amount calculation", { 
      subtotal, 
      platformFee, 
      gatewayFee, 
      totalAmount 
    });

    // Stripe requires minimum of R$ 0.50 for BRL
    const STRIPE_MIN_AMOUNT_BRL = 0.50;
    if (totalAmount < STRIPE_MIN_AMOUNT_BRL) {
      throw new Error(`O valor total deve ser no mínimo R$ ${STRIPE_MIN_AMOUNT_BRL.toFixed(2)}. Valor atual: R$ ${totalAmount.toFixed(2)}`);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: `${event.title} - ${ticket.batch_name}`,
              description: `${ticket.sector || ''} | ${new Date(event.event_date).toLocaleDateString('pt-BR')}`,
              images: event.image_url ? [event.image_url] : undefined,
            },
            unit_amount: Math.round(ticketPrice * 100), // Stripe uses cents
          },
          quantity: quantity,
        },
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: "Taxa da plataforma",
              description: platformFeePercentage 
                ? `${platformFeePercentage}% sobre o valor do ingresso`
                : `Taxa fixa por ingresso`,
            },
            unit_amount: Math.round(platformFee * 100),
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: "Taxa de processamento",
              description: `${gatewayFeePercentage}% sobre o valor do ingresso`,
            },
            unit_amount: Math.round(gatewayFee * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/event/${eventId}`,
      metadata: {
        eventId,
        ticketId,
        quantity: quantity.toString(),
        userId: user.id,
        platformFee: platformFee.toFixed(2),
        gatewayFee: gatewayFee.toFixed(2),
        producerAmount: subtotal.toFixed(2),
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-checkout", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ error: errorMessage }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
