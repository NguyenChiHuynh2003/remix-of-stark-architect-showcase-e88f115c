-- Create goods_issue_notes table (Xuất kho)
CREATE TABLE public.goods_issue_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gin_number TEXT NOT NULL UNIQUE,
  issue_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  recipient TEXT,
  purpose TEXT,
  project_id UUID REFERENCES public.projects(id),
  notes TEXT,
  total_value NUMERIC NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create gin_items table (Chi tiết phiếu xuất kho)
CREATE TABLE public.gin_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gin_id UUID NOT NULL REFERENCES public.goods_issue_notes(id) ON DELETE CASCADE,
  asset_master_id UUID NOT NULL REFERENCES public.asset_master_data(id),
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.goods_issue_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gin_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for goods_issue_notes
CREATE POLICY "Users can view all goods issue notes" 
ON public.goods_issue_notes 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create goods issue notes" 
ON public.goods_issue_notes 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update goods issue notes" 
ON public.goods_issue_notes 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete goods issue notes" 
ON public.goods_issue_notes 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- RLS policies for gin_items
CREATE POLICY "Users can view all gin items" 
ON public.gin_items 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create gin items" 
ON public.gin_items 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update gin items" 
ON public.gin_items 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete gin items" 
ON public.gin_items 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Create indexes for better performance
CREATE INDEX idx_gin_issue_date ON public.goods_issue_notes(issue_date DESC);
CREATE INDEX idx_gin_items_gin_id ON public.gin_items(gin_id);
CREATE INDEX idx_gin_items_asset_id ON public.gin_items(asset_master_id);

-- Update trigger for updated_at
CREATE TRIGGER update_goods_issue_notes_updated_at
BEFORE UPDATE ON public.goods_issue_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();