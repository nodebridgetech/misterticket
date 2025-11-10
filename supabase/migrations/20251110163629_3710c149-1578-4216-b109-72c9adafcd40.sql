-- Add Stripe-related fields to sales table
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'card';

-- Add index for faster Stripe lookups
CREATE INDEX IF NOT EXISTS idx_sales_stripe_payment_intent ON public.sales(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_sales_stripe_session ON public.sales(stripe_session_id);

-- Update sales table to allow inserting sales with stripe data
-- RLS policy for creating sales via checkout
CREATE POLICY "Users can create their own sales via checkout"
ON public.sales
FOR INSERT
WITH CHECK (auth.uid() = buyer_id);