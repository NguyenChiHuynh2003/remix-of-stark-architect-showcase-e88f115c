-- Delete all duplicate notifications, keeping only the earliest one per reference_id+type+user_id
DELETE FROM public.notifications
WHERE id NOT IN (
  SELECT DISTINCT ON (reference_id, type, user_id) id
  FROM public.notifications
  ORDER BY reference_id, type, user_id, created_at ASC
);

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX idx_notifications_unique_per_ref 
ON public.notifications (reference_id, type, user_id) 
WHERE reference_id IS NOT NULL;