-- Add CNPJ field to profiles table for producers
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cnpj text;

-- Create unique index for CNPJ (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_cnpj_unique ON public.profiles (cnpj) WHERE cnpj IS NOT NULL;