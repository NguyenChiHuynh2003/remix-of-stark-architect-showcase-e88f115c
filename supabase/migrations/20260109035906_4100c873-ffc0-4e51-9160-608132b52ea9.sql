-- Fix: Replace permissive notifications INSERT policy with user-scoped check
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

-- Users can only create notifications for themselves
CREATE POLICY "Users can create notifications for themselves"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Service role can create notifications for system messages
CREATE POLICY "Service role can create notifications"
ON public.notifications FOR INSERT TO service_role
WITH CHECK (true);