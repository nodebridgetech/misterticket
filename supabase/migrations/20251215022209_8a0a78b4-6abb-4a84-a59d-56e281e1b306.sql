-- Add address and birth date fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS cep text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS address_number text,
ADD COLUMN IF NOT EXISTS address_complement text,
ADD COLUMN IF NOT EXISTS birth_date date;