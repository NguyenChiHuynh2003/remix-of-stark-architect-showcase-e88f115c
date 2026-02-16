-- Add x, y position columns to org_chart_positions for free drag & drop
ALTER TABLE public.org_chart_positions 
ADD COLUMN IF NOT EXISTS x_position numeric DEFAULT 400,
ADD COLUMN IF NOT EXISTS y_position numeric DEFAULT 100,
ADD COLUMN IF NOT EXISTS width numeric DEFAULT 200,
ADD COLUMN IF NOT EXISTS height numeric DEFAULT 120;

-- Create a table for connections between positions (for custom line connections)
CREATE TABLE IF NOT EXISTS public.org_chart_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_chart_id uuid NOT NULL REFERENCES public.organization_charts(id) ON DELETE CASCADE,
  source_position_id uuid NOT NULL REFERENCES public.org_chart_positions(id) ON DELETE CASCADE,
  target_position_id uuid NOT NULL REFERENCES public.org_chart_positions(id) ON DELETE CASCADE,
  connection_type text NOT NULL DEFAULT 'hierarchy', -- 'hierarchy' or 'equal'
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(org_chart_id, source_position_id, target_position_id)
);

-- Enable RLS
ALTER TABLE public.org_chart_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies for connections
CREATE POLICY "Admins can manage org chart connections" 
ON public.org_chart_connections 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view org chart connections" 
ON public.org_chart_connections 
FOR SELECT 
USING (true);

-- Add email column to employees if not exists (for display in org chart)
-- Note: We'll use the user account email from profiles/auth instead