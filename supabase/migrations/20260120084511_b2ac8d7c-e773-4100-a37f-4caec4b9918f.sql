-- Create asset deletion history table
CREATE TABLE public.asset_deletion_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  cost_center TEXT,
  cost_basis NUMERIC DEFAULT 0,
  stock_quantity NUMERIC DEFAULT 0,
  deleted_by UUID NOT NULL,
  deleted_by_name TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deletion_reason TEXT,
  original_data JSONB
);

-- Enable RLS
ALTER TABLE public.asset_deletion_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins and inventory editors can view deletion history"
ON public.asset_deletion_history
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR can_view_module(auth.uid(), 'inventory'::text));

CREATE POLICY "Admins and inventory editors can insert deletion history"
ON public.asset_deletion_history
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR can_edit_module(auth.uid(), 'inventory'::text));

-- Add index for faster queries
CREATE INDEX idx_asset_deletion_history_deleted_at ON public.asset_deletion_history(deleted_at DESC);
CREATE INDEX idx_asset_deletion_history_deleted_by ON public.asset_deletion_history(deleted_by);