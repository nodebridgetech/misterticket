-- Add commission fields to utm_links table
ALTER TABLE public.utm_links 
ADD COLUMN commission_type TEXT NOT NULL DEFAULT 'percentage',
ADD COLUMN commission_value NUMERIC NOT NULL DEFAULT 0;

-- Add constraint to ensure valid commission type
ALTER TABLE public.utm_links 
ADD CONSTRAINT utm_links_commission_type_check 
CHECK (commission_type IN ('percentage', 'fixed'));