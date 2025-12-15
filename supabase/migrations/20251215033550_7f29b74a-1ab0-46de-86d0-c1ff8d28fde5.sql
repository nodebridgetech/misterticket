-- 1. Create refund_policy_config table for admin-managed refund/cancellation text
CREATE TABLE public.refund_policy_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_text TEXT NOT NULL DEFAULT 'Para informações sobre cancelamentos e reembolsos, entre em contato com o suporte através do WhatsApp.',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.refund_policy_config ENABLE ROW LEVEL SECURITY;

-- RLS policies for refund_policy_config
CREATE POLICY "Admins can manage refund policy" 
ON public.refund_policy_config 
FOR ALL 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Everyone can view active refund policy" 
ON public.refund_policy_config 
FOR SELECT 
USING (is_active = true);

-- Trigger for updated_at
CREATE TRIGGER update_refund_policy_updated_at
BEFORE UPDATE ON public.refund_policy_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default refund policy
INSERT INTO public.refund_policy_config (policy_text) 
VALUES ('Para informações sobre cancelamentos e reembolsos, entre em contato com o suporte através do WhatsApp.');

-- 2. Create ticket_transfers table to track transfer history
CREATE TABLE public.ticket_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  transferred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  transferred_by UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.ticket_transfers ENABLE ROW LEVEL SECURITY;

-- RLS policies for ticket_transfers
CREATE POLICY "Users can view their transfer history" 
ON public.ticket_transfers 
FOR SELECT 
USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can create transfers for their own tickets" 
ON public.ticket_transfers 
FOR INSERT 
WITH CHECK (auth.uid() = from_user_id AND auth.uid() = transferred_by);

CREATE POLICY "Admins can view all transfers" 
ON public.ticket_transfers 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Add unique constraint on email in profiles (if not exists)
-- First check if constraint exists and add only if it doesn't
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_email_unique'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);
  END IF;
END $$;