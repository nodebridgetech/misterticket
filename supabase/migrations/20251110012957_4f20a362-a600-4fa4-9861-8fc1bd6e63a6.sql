-- Create tickets table
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  batch_name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  quantity_total INTEGER NOT NULL,
  quantity_sold INTEGER NOT NULL DEFAULT 0,
  sale_start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  sale_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  sector TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tickets
CREATE POLICY "Everyone can view tickets for published events"
ON public.tickets
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = tickets.event_id
    AND e.is_published = true
    AND e.status = 'approved'
  )
);

CREATE POLICY "Producers can manage their event tickets"
ON public.tickets
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = tickets.event_id
    AND e.producer_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all tickets"
ON public.tickets
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Create sales table
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL,
  total_price NUMERIC(10, 2) NOT NULL,
  platform_fee NUMERIC(10, 2) NOT NULL,
  gateway_fee NUMERIC(10, 2) NOT NULL,
  producer_amount NUMERIC(10, 2) NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  qr_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sales
CREATE POLICY "Users can view their own sales"
ON public.sales
FOR SELECT
USING (auth.uid() = buyer_id);

CREATE POLICY "Producers can view sales for their events"
ON public.sales
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = sales.event_id
    AND e.producer_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all sales"
ON public.sales
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_tickets_updated_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_sales_updated_at
BEFORE UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();