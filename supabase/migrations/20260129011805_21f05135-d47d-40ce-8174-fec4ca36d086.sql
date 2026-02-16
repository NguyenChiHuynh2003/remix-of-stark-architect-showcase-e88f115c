-- Add return tracking fields to gin_items table
ALTER TABLE public.gin_items 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'issued',
ADD COLUMN IF NOT EXISTS returned_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS return_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS return_condition TEXT,
ADD COLUMN IF NOT EXISTS return_notes TEXT;

-- Add comment to explain the status field
COMMENT ON COLUMN public.gin_items.status IS 'issued = đã xuất, returned = đã hoàn trả, partial_returned = hoàn trả một phần';