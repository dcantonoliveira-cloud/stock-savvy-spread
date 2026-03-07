
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('supervisor', 'employee');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Employee permissions (configurable by supervisor)
CREATE TABLE public.employee_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  can_entry BOOLEAN NOT NULL DEFAULT true,
  can_output BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_permissions ENABLE ROW LEVEL SECURITY;

-- Stock items
CREATE TABLE public.stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  current_stock NUMERIC NOT NULL DEFAULT 0,
  min_stock NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

-- Stock entries (incoming stock)
CREATE TABLE public.stock_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL,
  unit_cost NUMERIC,
  supplier TEXT,
  invoice_number TEXT,
  notes TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  registered_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_entries ENABLE ROW LEVEL SECURITY;

-- Stock outputs
CREATE TABLE public.stock_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL,
  employee_name TEXT NOT NULL,
  event_name TEXT,
  notes TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  registered_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_outputs ENABLE ROW LEVEL SECURITY;

-- Technical sheets
CREATE TABLE public.technical_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  servings INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.technical_sheets ENABLE ROW LEVEL SECURITY;

-- Technical sheet items
CREATE TABLE public.technical_sheet_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id UUID NOT NULL REFERENCES public.technical_sheets(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL
);
ALTER TABLE public.technical_sheet_items ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stock_items_updated_at BEFORE UPDATE ON public.stock_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_employee_permissions_updated_at BEFORE UPDATE ON public.employee_permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_technical_sheets_updated_at BEFORE UPDATE ON public.technical_sheets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies

-- Profiles: everyone authenticated can read, users update own
CREATE POLICY "Authenticated users can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- User roles: supervisors can manage, users can read own
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Supervisors can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisors can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Supervisors can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'supervisor'));

-- Employee permissions: supervisors manage, employees read own
CREATE POLICY "Supervisors can manage permissions" ON public.employee_permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Employees can view own permissions" ON public.employee_permissions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Stock items: all authenticated can read, supervisors can manage
CREATE POLICY "Authenticated can view items" ON public.stock_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Supervisors can manage items" ON public.stock_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'supervisor'));

-- Stock entries: authenticated can read, insert based on permissions
CREATE POLICY "Authenticated can view entries" ON public.stock_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert entries" ON public.stock_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = registered_by);
CREATE POLICY "Supervisors can delete entries" ON public.stock_entries FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'supervisor'));

-- Stock outputs: authenticated can read, insert based on permissions
CREATE POLICY "Authenticated can view outputs" ON public.stock_outputs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert outputs" ON public.stock_outputs FOR INSERT TO authenticated WITH CHECK (auth.uid() = registered_by);
CREATE POLICY "Supervisors can delete outputs" ON public.stock_outputs FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'supervisor'));

-- Technical sheets: all can read, supervisors manage
CREATE POLICY "Authenticated can view sheets" ON public.technical_sheets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Supervisors can manage sheets" ON public.technical_sheets FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'supervisor'));

-- Technical sheet items
CREATE POLICY "Authenticated can view sheet items" ON public.technical_sheet_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Supervisors can manage sheet items" ON public.technical_sheet_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'supervisor'));

-- Function to update stock on entry
CREATE OR REPLACE FUNCTION public.update_stock_on_entry()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.stock_items SET current_stock = current_stock + NEW.quantity WHERE id = NEW.item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_stock_entry
  AFTER INSERT ON public.stock_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_stock_on_entry();

-- Function to update stock on output
CREATE OR REPLACE FUNCTION public.update_stock_on_output()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.stock_items SET current_stock = GREATEST(0, current_stock - NEW.quantity) WHERE id = NEW.item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_stock_output
  AFTER INSERT ON public.stock_outputs
  FOR EACH ROW EXECUTE FUNCTION public.update_stock_on_output();
