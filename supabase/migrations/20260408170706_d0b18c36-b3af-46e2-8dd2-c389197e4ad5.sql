-- Remove trial_url column from resources
ALTER TABLE public.resources DROP COLUMN IF EXISTS trial_url;

-- Create storage bucket for resource thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES ('resource-thumbnails', 'resource-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access
CREATE POLICY "Resource thumbnails are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'resource-thumbnails');

-- Admin upload
CREATE POLICY "Admins can upload resource thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'resource-thumbnails' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admin update
CREATE POLICY "Admins can update resource thumbnails"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'resource-thumbnails' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admin delete
CREATE POLICY "Admins can delete resource thumbnails"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'resource-thumbnails' AND public.has_role(auth.uid(), 'admin'::public.app_role));