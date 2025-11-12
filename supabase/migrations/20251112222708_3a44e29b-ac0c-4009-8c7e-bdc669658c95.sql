-- Add validation fields to sales table
ALTER TABLE public.sales 
ADD COLUMN validated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN validated_by UUID REFERENCES auth.users(id);

-- Create index for faster QR code lookups
CREATE INDEX idx_sales_qr_code ON public.sales(qr_code);
CREATE INDEX idx_sales_validated_at ON public.sales(validated_at);

-- Add RLS policy for producers to validate QR codes from their events
CREATE POLICY "Producers can validate QR codes for their events"
ON public.sales
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = sales.event_id
    AND e.producer_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = sales.event_id
    AND e.producer_id = auth.uid()
  )
);

-- Add RLS policy for producers to view QR code details only for their events
CREATE POLICY "Producers can view QR details for their events"
ON public.sales
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = sales.event_id
    AND e.producer_id = auth.uid()
  )
  OR auth.uid() = buyer_id
  OR has_role(auth.uid(), 'admin'::app_role)
);