-- Add image_url field to categories table
ALTER TABLE public.categories 
ADD COLUMN image_url text;

-- Add comment
COMMENT ON COLUMN public.categories.image_url IS 'URL or path to category icon/image';