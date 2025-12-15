
-- Create notifications table for producers
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  producer_id UUID NOT NULL,
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Producers can view their own notifications
CREATE POLICY "Producers can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = producer_id);

-- Producers can update their own notifications (mark as read)
CREATE POLICY "Producers can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = producer_id);

-- Allow service role to insert notifications (from trigger)
CREATE POLICY "Service can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create function to generate notification on new sale
CREATE OR REPLACE FUNCTION public.create_sale_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_event_title TEXT;
  v_producer_id UUID;
  v_buyer_name TEXT;
  v_ticket_name TEXT;
BEGIN
  -- Only create notification for completed sales
  IF NEW.payment_status = 'completed' THEN
    -- Get event info and producer
    SELECT e.title, e.producer_id INTO v_event_title, v_producer_id
    FROM public.events e
    WHERE e.id = NEW.event_id;
    
    -- Get buyer name
    SELECT p.full_name INTO v_buyer_name
    FROM public.profiles p
    WHERE p.user_id = NEW.buyer_id;
    
    -- Get ticket name
    SELECT t.batch_name INTO v_ticket_name
    FROM public.tickets t
    WHERE t.id = NEW.ticket_id;
    
    -- Insert notification
    INSERT INTO public.notifications (producer_id, sale_id, event_id, title, message)
    VALUES (
      v_producer_id,
      NEW.id,
      NEW.event_id,
      'Nova venda!',
      COALESCE(v_buyer_name, 'Cliente') || ' comprou ' || NEW.quantity || 'x ' || COALESCE(v_ticket_name, 'ingresso') || ' para ' || COALESCE(v_event_title, 'seu evento')
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new sales
CREATE TRIGGER on_sale_completed
AFTER INSERT OR UPDATE OF payment_status ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.create_sale_notification();
