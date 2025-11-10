-- Create events table
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  producer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  venue TEXT NOT NULL,
  address TEXT NOT NULL,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Enable RLS on events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for events
CREATE POLICY "Producers can view their own events"
ON public.events
FOR SELECT
USING (auth.uid() = producer_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Producers can create events"
ON public.events
FOR INSERT
WITH CHECK (auth.uid() = producer_id);

CREATE POLICY "Producers can update their own events"
ON public.events
FOR UPDATE
USING (auth.uid() = producer_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete events"
ON public.events
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone can view approved published events"
ON public.events
FOR SELECT
USING (is_published = true AND status = 'approved');

-- Create trigger for events updated_at
CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Create fee configuration table
CREATE TABLE public.fee_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  platform_fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  payment_gateway_fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 3.00,
  min_withdrawal_amount DECIMAL(10,2) NOT NULL DEFAULT 50.00,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS on fee_config
ALTER TABLE public.fee_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fee_config
CREATE POLICY "Admins can manage fee config"
ON public.fee_config
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone can view active fee config"
ON public.fee_config
FOR SELECT
USING (is_active = true);

-- Create trigger for fee_config updated_at
CREATE TRIGGER update_fee_config_updated_at
BEFORE UPDATE ON public.fee_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Insert default fee configuration
INSERT INTO public.fee_config (platform_fee_percentage, payment_gateway_fee_percentage, min_withdrawal_amount)
VALUES (10.00, 3.00, 50.00);