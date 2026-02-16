-- Fix: Restrict contract_guarantees access to authorized roles only
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view contract guarantees" ON public.contract_guarantees;

-- Create a restricted policy that limits access to:
-- 1. Admins
-- 2. Accountants
-- 3. Users with accounting module access
-- 4. Team members of the associated project
CREATE POLICY "Authorized users can view contract guarantees"
ON public.contract_guarantees
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'accountant'::app_role) OR
  can_view_module(auth.uid(), 'accounting'::text) OR
  EXISTS (
    SELECT 1 FROM contracts c
    WHERE c.id = contract_guarantees.contract_id
    AND c.project_id IS NOT NULL
    AND user_can_access_project(auth.uid(), c.project_id)
  )
);