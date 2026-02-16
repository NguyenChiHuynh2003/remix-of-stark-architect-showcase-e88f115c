-- Add new columns to employees table for additional employee information
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS employee_code TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS ethnicity TEXT,
ADD COLUMN IF NOT EXISTS citizen_id TEXT,
ADD COLUMN IF NOT EXISTS citizen_id_issue_date DATE,
ADD COLUMN IF NOT EXISTS citizen_id_issue_place TEXT,
ADD COLUMN IF NOT EXISTS work_type TEXT,
ADD COLUMN IF NOT EXISTS education_level TEXT,
ADD COLUMN IF NOT EXISTS major TEXT,
ADD COLUMN IF NOT EXISTS marital_status TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add index on employee_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_employees_employee_code ON public.employees(employee_code);

-- Add index on citizen_id for faster lookups  
CREATE INDEX IF NOT EXISTS idx_employees_citizen_id ON public.employees(citizen_id);