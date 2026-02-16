-- Fix: Remove overly permissive policy that bypasses inventory access controls
-- The policy "Authenticated users can view GRN" uses USING(true) which grants access to ALL authenticated users
-- This conflicts with the restrictive policy that limits access to inventory module users only

DROP POLICY IF EXISTS "Authenticated users can view GRN" ON public.goods_receipt_notes;