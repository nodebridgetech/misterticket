-- Create table for custom producer fees
CREATE TABLE public.producer_custom_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  producer_id UUID NOT NULL,
  platform_fee_percentage NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(producer_id)
);

-- Enable RLS
ALTER TABLE public.producer_custom_fees ENABLE ROW LEVEL SECURITY;

-- Admins can manage custom fees
CREATE POLICY "Admins can manage custom fees"
ON public.producer_custom_fees
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can view all custom fees
CREATE POLICY "Admins can view custom fees"
ON public.producer_custom_fees
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Producers can view their own custom fee
CREATE POLICY "Producers can view their own custom fee"
ON public.producer_custom_fees
FOR SELECT
USING (auth.uid() = producer_id);

-- Create trigger for updated_at
CREATE TRIGGER update_producer_custom_fees_updated_at
BEFORE UPDATE ON public.producer_custom_fees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();