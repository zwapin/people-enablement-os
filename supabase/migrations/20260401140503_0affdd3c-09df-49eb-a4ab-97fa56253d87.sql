
-- Create public bucket for module content media (images, gifs, videos)
INSERT INTO storage.buckets (id, name, public) VALUES ('module-media', 'module-media', true);

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload module media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'module-media');

-- Allow public read access
CREATE POLICY "Public read access for module media"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'module-media');

-- Allow admins to delete module media
CREATE POLICY "Admins can delete module media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'module-media' AND public.has_role(auth.uid(), 'admin'));
