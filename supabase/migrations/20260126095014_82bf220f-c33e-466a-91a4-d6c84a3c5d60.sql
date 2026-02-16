-- Fix: Make employee-photos bucket public so images can be viewed
UPDATE storage.buckets 
SET public = true 
WHERE id = 'employee-photos';

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access for employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete employee photos" ON storage.objects;

-- Create proper RLS policies for employee-photos bucket

-- Allow anyone to view photos (since bucket is public)
CREATE POLICY "Allow public read access for employee photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'employee-photos');

-- Allow authenticated users to upload photos
CREATE POLICY "Authenticated users can upload employee photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'employee-photos');

-- Allow authenticated users to update their uploaded photos
CREATE POLICY "Authenticated users can update employee photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'employee-photos');

-- Allow authenticated users to delete photos
CREATE POLICY "Authenticated users can delete employee photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'employee-photos');