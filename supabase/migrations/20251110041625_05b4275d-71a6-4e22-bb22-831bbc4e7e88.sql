-- Create storage bucket for event images
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true);

-- Allow anyone to view images (bucket is public)
CREATE POLICY "Anyone can view event images"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-images');

-- Allow authenticated producers to upload their event images
CREATE POLICY "Producers can upload event images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'event-images' 
  AND auth.role() = 'authenticated'
);

-- Allow producers to update their own event images
CREATE POLICY "Producers can update their event images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'event-images' 
  AND auth.role() = 'authenticated'
);

-- Allow producers to delete their own event images
CREATE POLICY "Producers can delete their event images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'event-images' 
  AND auth.role() = 'authenticated'
);