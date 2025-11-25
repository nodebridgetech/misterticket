-- Add pixel tracking fields to events table
ALTER TABLE public.events
ADD COLUMN google_pixel_code TEXT,
ADD COLUMN meta_pixel_code TEXT;

COMMENT ON COLUMN public.events.google_pixel_code IS 'Google Ads pixel code for tracking';
COMMENT ON COLUMN public.events.meta_pixel_code IS 'Meta (Facebook) Ads pixel code for tracking';