-- Create warehouses table
CREATE TABLE public.warehouses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users with inventory access can view warehouses"
ON public.warehouses
FOR SELECT
USING (has_role(auth.uid(), 'admin') OR can_view_module(auth.uid(), 'inventory'));

CREATE POLICY "Admins and inventory editors can manage warehouses"
ON public.warehouses
FOR ALL
USING (has_role(auth.uid(), 'admin') OR can_edit_module(auth.uid(), 'inventory'))
WITH CHECK (has_role(auth.uid(), 'admin') OR can_edit_module(auth.uid(), 'inventory'));

-- Insert default warehouses (excluding KHO QUÀ BIẾU QUÀ TẶNG as requested)
INSERT INTO public.warehouses (name) VALUES
  ('KHO CHÍNH'),
  ('KHO BẢO HỘ LAO ĐỘNG'),
  ('KHO CÔNG CỤ DỤNG CỤ'),
  ('KHO VẬT TƯ'),
  ('KHO THIẾT BỊ');

-- Add trigger for updated_at
CREATE TRIGGER update_warehouses_updated_at
BEFORE UPDATE ON public.warehouses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();