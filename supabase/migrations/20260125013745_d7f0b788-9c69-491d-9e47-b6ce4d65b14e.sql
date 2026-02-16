-- Create table to store backup schedule configuration
CREATE TABLE IF NOT EXISTS public.backup_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_hour INTEGER NOT NULL DEFAULT 2,
  backup_minute INTEGER NOT NULL DEFAULT 0,
  notification_email TEXT NOT NULL DEFAULT 'zhunter1501@gmail.com',
  is_enabled BOOLEAN DEFAULT true,
  last_backup_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.backup_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view and modify backup settings
CREATE POLICY "Admins can view backup settings" ON public.backup_settings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update backup settings" ON public.backup_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert backup settings" ON public.backup_settings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Insert default settings if not exists
INSERT INTO public.backup_settings (backup_hour, backup_minute, notification_email, is_enabled)
VALUES (2, 0, 'zhunter1501@gmail.com', true)
ON CONFLICT DO NOTHING;

-- Create trigger for updated_at
CREATE TRIGGER update_backup_settings_updated_at
  BEFORE UPDATE ON public.backup_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();