import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import type { User } from '@supabase/supabase-js';

type Role = 'supervisor' | 'employee' | null;

interface Permissions {
  can_entry: boolean;
  can_output: boolean;
  access_stock: boolean;
  access_materials: boolean;
}

interface AuthContextType {
  user: User | null;
  role: Role;
  permissions: Permissions;
  profile: { display_name: string; email: string } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [permissions, setPermissions] = useState<Permissions>({ can_entry: true, can_output: true, access_stock: true, access_materials: false });
  const [profile, setProfile] = useState<{ display_name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    const [rolesRes, permRes, profileRes] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', userId),
      supabase.from('employee_permissions').select('can_entry, can_output, access_stock, access_materials').eq('user_id', userId).maybeSingle(),
      supabase.from('profiles').select('display_name, email').eq('user_id', userId).maybeSingle(),
    ]);

    if (rolesRes.data && rolesRes.data.length > 0) {
      const roles = rolesRes.data.map(r => r.role);
      setRole(roles.includes('supervisor') ? 'supervisor' : 'employee');
    } else {
      setRole(null);
    }

    if (permRes.data) {
      setPermissions({
        can_entry: permRes.data.can_entry,
        can_output: permRes.data.can_output,
        access_stock: (permRes.data as any).access_stock ?? true,
        access_materials: (permRes.data as any).access_materials ?? false,
      });
    }

    if (profileRes.data) {
      setProfile(profileRes.data);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        setTimeout(() => fetchUserData(session.user.id), 0);
      } else {
        setUser(null);
        setRole(null);
        setProfile(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signInWithGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
    return { error: result?.error || null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, role, permissions, profile, loading, signIn, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
