-- Update RLS policy to allow inventory module users to view employees for allocation purposes
DROP POLICY IF EXISTS "Admins and HR can view all employees, users can view own record" ON public.employees;

CREATE POLICY "Users with proper access can view employees"
ON public.employees
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'hr_admin'::app_role) 
  OR (user_id = auth.uid())
  OR can_view_module(auth.uid(), 'inventory'::text)
  OR can_edit_module(auth.uid(), 'inventory'::text)
);