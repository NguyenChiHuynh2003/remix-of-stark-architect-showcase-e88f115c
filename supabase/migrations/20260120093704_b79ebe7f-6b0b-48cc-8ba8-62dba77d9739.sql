-- Add restoration_history column to track partial restorations
ALTER TABLE public.asset_deletion_history
ADD COLUMN IF NOT EXISTS restoration_history JSONB DEFAULT '[]'::jsonb;