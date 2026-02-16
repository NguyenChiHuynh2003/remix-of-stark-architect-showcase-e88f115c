-- Drop overly permissive INSERT and UPDATE policies for asset_allocations
-- Note: Correct restrictive policies already exist ("Inventory managers can create allocations" and "Inventory managers can update allocations")

DROP POLICY IF EXISTS "Authenticated users can create allocations" ON public.asset_allocations;
DROP POLICY IF EXISTS "Authenticated users can update allocations" ON public.asset_allocations;