-- Add is_trending column to events table
ALTER TABLE public.events
ADD COLUMN is_trending boolean NOT NULL DEFAULT false;

-- Add comment
COMMENT ON COLUMN public.events.is_trending IS 'Indicates if event should be shown in trending section on homepage';