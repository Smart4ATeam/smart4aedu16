-- Create private storage bucket for resource templates
INSERT INTO storage.buckets (id, name, public)
VALUES ('resource-templates', 'resource-templates', false);

-- Admin can upload templates
CREATE POLICY "Admins can upload resource templates"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'resource-templates'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Admin can update templates
CREATE POLICY "Admins can update resource templates"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'resource-templates'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Admin can delete templates
CREATE POLICY "Admins can delete resource templates"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'resource-templates'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Admin can view templates (for listing)
CREATE POLICY "Admins can view resource templates"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'resource-templates'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Add template_file_path to resources table
ALTER TABLE public.resources
ADD COLUMN template_file_path text;