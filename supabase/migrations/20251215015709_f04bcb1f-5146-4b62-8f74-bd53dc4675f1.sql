-- Add fee_type column to producer_custom_fees table
ALTER TABLE public.producer_custom_fees
ADD COLUMN fee_type TEXT NOT NULL DEFAULT 'percentage' CHECK (fee_type IN ('percentage', 'fixed'));

-- Rename column to be more generic
ALTER TABLE public.producer_custom_fees
RENAME COLUMN platform_fee_percentage TO fee_value;

-- Add comment for clarity
COMMENT ON COLUMN public.producer_custom_fees.fee_type IS 'Type of fee: percentage (applied as % of subtotal) or fixed (fixed amount in BRL)';
COMMENT ON COLUMN public.producer_custom_fees.fee_value IS 'Fee value: percentage (0-100) or fixed amount in BRL';