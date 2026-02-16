-- Create employee_contracts table
CREATE TABLE public.employee_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  contract_type TEXT NOT NULL,
  start_work_date DATE,
  contract_sign_date DATE,
  contract_end_date DATE,
  social_insurance_status TEXT,
  work_status TEXT DEFAULT 'Đang làm việc',
  termination_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_contracts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view employee contracts"
ON public.employee_contracts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert employee contracts"
ON public.employee_contracts FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update employee contracts"
ON public.employee_contracts FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete employee contracts"
ON public.employee_contracts FOR DELETE
TO authenticated
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_employee_contracts_updated_at
BEFORE UPDATE ON public.employee_contracts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();