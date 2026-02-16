-- Drop the existing foreign key constraint on gin_items
ALTER TABLE public.gin_items 
DROP CONSTRAINT IF EXISTS gin_items_asset_master_id_fkey;

-- Re-add foreign key with ON DELETE SET NULL
-- This allows deleting assets when GIN items have been returned
ALTER TABLE public.gin_items 
ADD CONSTRAINT gin_items_asset_master_id_fkey 
FOREIGN KEY (asset_master_id) 
REFERENCES public.asset_master_data(id) 
ON DELETE SET NULL;

-- Make asset_master_id nullable to support SET NULL
ALTER TABLE public.gin_items 
ALTER COLUMN asset_master_id DROP NOT NULL;