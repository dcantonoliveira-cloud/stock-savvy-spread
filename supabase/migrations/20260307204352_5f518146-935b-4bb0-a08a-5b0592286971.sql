
-- Allow the first user to self-assign as supervisor (bootstrap)
-- This policy will be active only when no supervisors exist
CREATE POLICY "First user can become supervisor" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    AND role = 'supervisor'
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'supervisor')
  );

-- Allow profiles to be inserted by trigger (service role)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Add policy for service role inserts (trigger)
CREATE POLICY "Service role can insert profiles" ON public.profiles
  FOR INSERT TO service_role
  WITH CHECK (true);
