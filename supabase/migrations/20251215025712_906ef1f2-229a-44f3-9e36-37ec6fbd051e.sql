-- Create UTM links table
CREATE TABLE public.utm_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  producer_id UUID NOT NULL,
  name TEXT NOT NULL,
  utm_code TEXT NOT NULL UNIQUE,
  applies_to_all_events BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create junction table for UTM links and events
CREATE TABLE public.utm_link_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  utm_link_id UUID NOT NULL REFERENCES public.utm_links(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(utm_link_id, event_id)
);

-- Add utm_link_id to event_analytics for tracking
ALTER TABLE public.event_analytics ADD COLUMN utm_link_id UUID REFERENCES public.utm_links(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.utm_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utm_link_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for utm_links
CREATE POLICY "Producers can view their own UTM links"
ON public.utm_links FOR SELECT
USING (auth.uid() = producer_id);

CREATE POLICY "Producers can create their own UTM links"
ON public.utm_links FOR INSERT
WITH CHECK (auth.uid() = producer_id);

CREATE POLICY "Producers can update their own UTM links"
ON public.utm_links FOR UPDATE
USING (auth.uid() = producer_id);

CREATE POLICY "Producers can delete their own UTM links"
ON public.utm_links FOR DELETE
USING (auth.uid() = producer_id);

CREATE POLICY "Admins can manage all UTM links"
ON public.utm_links FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for utm_link_events
CREATE POLICY "Producers can view their UTM link events"
ON public.utm_link_events FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.utm_links ul
  WHERE ul.id = utm_link_events.utm_link_id AND ul.producer_id = auth.uid()
));

CREATE POLICY "Producers can manage their UTM link events"
ON public.utm_link_events FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.utm_links ul
  WHERE ul.id = utm_link_events.utm_link_id AND ul.producer_id = auth.uid()
));

CREATE POLICY "Admins can manage all UTM link events"
ON public.utm_link_events FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_utm_links_updated_at
BEFORE UPDATE ON public.utm_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();