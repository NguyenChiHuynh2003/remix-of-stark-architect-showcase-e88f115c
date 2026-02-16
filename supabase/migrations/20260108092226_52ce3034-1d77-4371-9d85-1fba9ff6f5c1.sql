-- Fix PUBLIC_DATA_EXPOSURE: Update policies to require authentication

-- 1. Drop and recreate contracts SELECT policy to require authentication
DROP POLICY IF EXISTS "Authenticated users can view contracts" ON public.contracts;
CREATE POLICY "Authenticated users can view contracts"
ON public.contracts
FOR SELECT
TO authenticated
USING (true);

-- 2. Drop and recreate contract_guarantees SELECT policy to require authentication
DROP POLICY IF EXISTS "Authenticated users can view contract guarantees" ON public.contract_guarantees;
CREATE POLICY "Authenticated users can view contract guarantees"
ON public.contract_guarantees
FOR SELECT
TO authenticated
USING (true);

-- 3. Drop and recreate handover_slips SELECT policy to require authentication
DROP POLICY IF EXISTS "Users can view handover slips" ON public.handover_slips;
CREATE POLICY "Authenticated users can view handover slips"
ON public.handover_slips
FOR SELECT
TO authenticated
USING (true);

-- 4. Drop and recreate profiles SELECT policy to require authentication
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 5. Drop and recreate organization_charts SELECT policy to require authentication
DROP POLICY IF EXISTS "Users can view org charts" ON public.organization_charts;
CREATE POLICY "Authenticated users can view org charts"
ON public.organization_charts
FOR SELECT
TO authenticated
USING (true);

-- 6. Drop and recreate org_chart_positions SELECT policy to require authentication
DROP POLICY IF EXISTS "Users can view org chart positions" ON public.org_chart_positions;
CREATE POLICY "Authenticated users can view org chart positions"
ON public.org_chart_positions
FOR SELECT
TO authenticated
USING (true);

-- 7. Drop and recreate org_chart_connections SELECT policy to require authentication
DROP POLICY IF EXISTS "Users can view org chart connections" ON public.org_chart_connections;
CREATE POLICY "Authenticated users can view org chart connections"
ON public.org_chart_connections
FOR SELECT
TO authenticated
USING (true);

-- 8. Drop and recreate goods_receipt_notes SELECT policy to require authentication
DROP POLICY IF EXISTS "Authenticated users can view GRN" ON public.goods_receipt_notes;
CREATE POLICY "Authenticated users can view GRN"
ON public.goods_receipt_notes
FOR SELECT
TO authenticated
USING (true);

-- Fix MISSING_RLS: Add storage bucket RLS policies

-- Create buckets if they don't exist (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-photos', 'employee-photos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

INSERT INTO storage.buckets (id, name, public)
VALUES ('database-backups', 'database-backups', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Drop existing storage policies if any
DROP POLICY IF EXISTS "Authenticated users upload employee photos" ON storage.objects;
DROP POLICY IF EXISTS "HR and admins view employee photos" ON storage.objects;
DROP POLICY IF EXISTS "HR and admins delete employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Service role writes backups" ON storage.objects;
DROP POLICY IF EXISTS "Admins view backups" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete old backups" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view employee photos" ON storage.objects;
DROP POLICY IF EXISTS "HR admins can upload employee photos" ON storage.objects;
DROP POLICY IF EXISTS "HR admins can update employee photos" ON storage.objects;
DROP POLICY IF EXISTS "HR admins can delete employee photos" ON storage.objects;

-- Create policies for employee-photos bucket
CREATE POLICY "Authenticated users can view employee photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'employee-photos');

CREATE POLICY "HR and admins can upload employee photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'employee-photos' AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr_admin'::app_role) OR can_edit_module(auth.uid(), 'hr'::text))
);

CREATE POLICY "HR and admins can update employee photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'employee-photos' AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr_admin'::app_role) OR can_edit_module(auth.uid(), 'hr'::text))
);

CREATE POLICY "HR and admins can delete employee photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'employee-photos' AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'hr_admin'::app_role) OR can_edit_module(auth.uid(), 'hr'::text))
);

-- Create policies for database-backups bucket
CREATE POLICY "Admins can view backups"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'database-backups' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete old backups"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'database-backups' AND has_role(auth.uid(), 'admin'::app_role));