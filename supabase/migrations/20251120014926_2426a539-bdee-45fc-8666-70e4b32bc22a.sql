-- Add position column to categories table for ordering
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS position INTEGER;

-- Set initial positions based on created_at
UPDATE public.categories 
SET position = subquery.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as row_num
  FROM public.categories
) AS subquery
WHERE categories.id = subquery.id;