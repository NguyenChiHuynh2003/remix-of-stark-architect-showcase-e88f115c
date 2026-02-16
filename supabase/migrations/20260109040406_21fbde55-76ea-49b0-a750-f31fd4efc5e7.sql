-- Drop and recreate the remaining policies that already exist
DROP POLICY IF EXISTS "HR and admins can upload employee photos" ON storage.objects;

-- Recreate with proper authenticated role
CREATE POLICY "HR and admins can upload employee photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'employee-photos' AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr_admin'::app_role))
);