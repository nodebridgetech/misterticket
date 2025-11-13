-- Add qr_token column to sales table for secure QR code generation
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS qr_token text UNIQUE;

-- Create index for fast lookups by QR token
CREATE INDEX IF NOT EXISTS idx_sales_qr_token ON public.sales(qr_token);