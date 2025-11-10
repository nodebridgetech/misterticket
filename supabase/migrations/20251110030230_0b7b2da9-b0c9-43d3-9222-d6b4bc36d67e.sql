-- First drop the policies that depend on status column
DROP POLICY IF EXISTS "Everyone can view approved published events" ON public.events;
DROP POLICY IF EXISTS "Everyone can view tickets for published events" ON public.tickets;

-- Create new policies without status column
CREATE POLICY "Everyone can view published events" 
ON public.events 
FOR SELECT 
USING (is_published = true);

CREATE POLICY "Everyone can view tickets for published events" 
ON public.tickets 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM events e 
  WHERE e.id = tickets.event_id 
  AND e.is_published = true
));

-- Now remove the status column
ALTER TABLE public.events DROP COLUMN status;