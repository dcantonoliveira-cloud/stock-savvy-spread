import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import type { User } from '@supabase/supabase-js';

type Role = 'supervisor' | 'employee' | 'client' | null;

export interface Permissions {
  // legacy employee flags
  can_entry: boolean;
  can_output: boolean;
  // modules
  access_stock: boolean;
  access_materials: boolean;
  access_comercial: boolean;
  access_financeiro: boolean;
  access_estoque: boolean;
  access_cadastros: boolean;
  access_estatisticas: boolean;
  access_administracao: boolean;
  // admin flag — can manage other users' permissions
  is_admin: boolean;
}

// Supervisors with no permissions row get full access
const SUPERVISOR_DEFAULTS: Permissions = {
  can_entry: true,
  can_output: true,
  access_stock: true,
  access_materials: true,
  access_comercial: true,
  access_financeiro: true,
  access_estoque: true,
  access_cadastros: true,
  access_estatisticas: true,
  access_administracao: true,
  is_admin: true,
};

const EMPLOYEE_DEFAULTS: Permissions = {
  can_entry: true,
  can_output: true,
  access_stock: true,
  access_materials: false,
  access_comercial: false,
  access_financeiro: false,
  access_estoque: false,
  access_cadastros: false,
  access_estatisticas: false,
  access_administracao: false,
  is_admin: false,
};

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
  const [permissions, setPermissions] = useState<Permissions>(EMPLOYEE_DEFAULTS);
  const [profile, setProfile] = useState<{ display_name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    const [rolesRes, permRes, profileRes, clientRes] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', userId),
      supabase.from('employee_permissions').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('profiles').select('display_name, email').eq('user_id', userId).maybeSingle(),
      (supabase.from as any)('client_portal_access').select('id').eq('user_id', userId).maybeSingle(),
    ]);

    let resolvedRole: Role = null;
    if (rolesRes.data && rolesRes.data.length > 0) {
      const roles = rolesRes.data.map(r => r.role);
      resolvedRole = roles.includes('supervisor') ? 'supervisor' : 'employee';
    } else if (clientRes.data) {
      resolvedRole = 'client';
    }
    setRole(resolvedRole);

    const p = permRes.data as any;
    if (p) {
      setPermissions({
        can_entry:             p.can_entry          ?? true,
        can_output:            p.can_output         ?? true,
        access_stock:          p.access_stock       ?? true,
        access_materials:      p.access_materials   ?? false,
        access_comercial:      p.access_comercial   ?? (resolvedRole === 'supervisor'),
        access_financeiro:     p.access_financeiro  ?? false,
        access_estoque:        p.access_estoque     ?? false,
        access_cadastros:      p.access_cadastros   ?? false,
        access_estatisticas:   p.access_estatisticas ?? false,
        access_administracao:  p.access_administracao ?? false,
        is_admin:              p.is_admin           ?? false,
      });
    } else {
      // No row → full access for supervisors, defaults for employees
      setPermissions(resolvedRole === 'supervisor' ? SUPERVISOR_DEFAULTS : EMPLOYEE_DEFAULTS);
    }

    if (profileRes.data) setProfile(profileRes.data);
  };

  useEffect(() => {
    let currentUserId: string | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        currentUserId = session.user.id;
        setUser(session.user);
        setTimeout(() => fetchUserData(session.user.id), 0);
      } else {
        currentUserId = null;
        setUser(null);
        setRole(null);
        setProfile(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        currentUserId = session.user.id;
        setUser(session.user);
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    // Atualiza permissões em tempo real quando o admin salvar mudanças
    const permChannel = supabase
      .channel('permissions-watch')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'employee_permissions',
      }, (payload: any) => {
        const changedUserId = payload.new?.user_id ?? payload.old?.user_id;
        if (currentUserId && changedUserId === currentUserId) {
          fetchUserData(currentUserId);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(permChannel);
    };
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
