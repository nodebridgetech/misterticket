-- Add is_active column to events table
ALTER TABLE public.events 
ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- Update RLS policy for public viewing to consider is_active
DROP POLICY IF EXISTS "Everyone can view published events" ON public.events;

CREATE POLICY "Everyone can view published and active events" 
ON public.events 
FOR SELECT 
USING (is_published = true AND is_active = true);

-- Update RLS policy for tickets to consider event is_active
DROP POLICY IF EXISTS "Everyone can view tickets for published events" ON public.tickets;

CREATE POLICY "Everyone can view tickets for published and active events" 
ON public.tickets 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM events e
    WHERE e.id = tickets.event_id 
    AND e.is_published = true 
    AND e.is_active = true
  )
);