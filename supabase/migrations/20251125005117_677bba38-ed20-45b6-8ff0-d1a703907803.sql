-- Add number and complement fields to events table
ALTER TABLE public.events 
ADD COLUMN address_number text,
ADD COLUMN address_complement text;