-- Add is_featured column to events table
ALTER TABLE public.events
ADD COLUMN is_featured boolean NOT NULL DEFAULT false;

-- Create index for better performance when querying featured events
CREATE INDEX idx_events_is_featured ON public.events(is_featured) WHERE is_featured = true;

-- Add comment to document the column
COMMENT ON COLUMN public.events.is_featured IS 'Indicates if the event should be featured in the homepage banner carousel';