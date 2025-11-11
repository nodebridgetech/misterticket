-- Create function to increment ticket quantity sold
CREATE OR REPLACE FUNCTION public.increment_ticket_sold(ticket_id uuid, quantity_increment integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tickets
  SET quantity_sold = COALESCE(quantity_sold, 0) + quantity_increment
  WHERE id = ticket_id;
END;
$$;