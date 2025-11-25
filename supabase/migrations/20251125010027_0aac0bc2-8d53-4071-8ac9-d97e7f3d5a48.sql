-- Add event_end_date column to events table
ALTER TABLE public.events
ADD COLUMN event_end_date timestamp with time zone;