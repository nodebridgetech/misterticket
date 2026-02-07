-- Make sale_start_date and sale_end_date nullable to support optional batch timing
ALTER TABLE public.tickets 
  ALTER COLUMN sale_start_date DROP NOT NULL,
  ALTER COLUMN sale_end_date DROP NOT NULL;