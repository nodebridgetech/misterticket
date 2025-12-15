-- Add platform_fee_type column to fee_config table
ALTER TABLE public.fee_config
ADD COLUMN platform_fee_type TEXT NOT NULL DEFAULT 'percentage' CHECK (platform_fee_type IN ('percentage', 'fixed'));

-- Rename column to be more generic
ALTER TABLE public.fee_config
RENAME COLUMN platform_fee_percentage TO platform_fee_value;

-- Add comment for clarity
COMMENT ON COLUMN public.fee_config.platform_fee_type IS 'Type of platform fee: percentage (applied as % of subtotal) or fixed (fixed amount in BRL per ticket)';
COMMENT ON COLUMN public.fee_config.platform_fee_value IS 'Platform fee value: percentage (0-100) or fixed amount in BRL per ticket';