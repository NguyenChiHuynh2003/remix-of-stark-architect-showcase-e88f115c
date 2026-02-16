-- Fix 1: Replace permissive asset_allocations INSERT policy with role-based check
DROP POLICY IF EXISTS "Authenticated users can create allocations" ON public.asset_allocations;
CREATE POLICY "Inventory managers can create allocations"
ON public.asset_allocations FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  can_edit_module(auth.uid(), 'inventory'::text)
);

-- Fix 2: Replace permissive asset_allocations UPDATE policy with role-based check
DROP POLICY IF EXISTS "Authenticated users can update allocations" ON public.asset_allocations;
CREATE POLICY "Inventory managers can update allocations"
ON public.asset_allocations FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  can_edit_module(auth.uid(), 'inventory'::text)
);

-- Fix 3: Add INSERT policy for service_role on database-backups storage bucket
CREATE POLICY "Service role can upload backups"
ON storage.objects FOR INSERT TO service_role
WITH CHECK (bucket_id = 'database-backups');