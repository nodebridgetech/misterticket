-- Create event_analytics table to track user interactions
CREATE TABLE public.event_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('page_view', 'ticket_click', 'checkout_click')),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_event_analytics_event_id ON public.event_analytics(event_id);
CREATE INDEX idx_event_analytics_event_type ON public.event_analytics(event_type);
CREATE INDEX idx_event_analytics_ticket_id ON public.event_analytics(ticket_id);

-- Enable RLS
ALTER TABLE public.event_analytics ENABLE ROW LEVEL SECURITY;

-- Anyone can insert analytics (tracking events)
CREATE POLICY "Anyone can insert analytics" 
ON public.event_analytics 
FOR INSERT 
WITH CHECK (true);

-- Producers can view analytics for their events
CREATE POLICY "Producers can view their event analytics" 
ON public.event_analytics 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_analytics.event_id
    AND e.producer_id = auth.uid()
  )
);

-- Admins can view all analytics
CREATE POLICY "Admins can view all analytics" 
ON public.event_analytics 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));