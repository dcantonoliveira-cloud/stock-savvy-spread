import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, Permissions } from '@/hooks/useAuth';

// Mapa rota → permissão necessária (mesma lógica da sidebar).
// A ordem importa: prefixos mais específicos primeiro.
const ROUTE_PERMS: [string, keyof Permissions][] = [
  ['/financeiro',     'access_financeiro'],
  ['/estatisticas',   'access_estatisticas'],
  ['/materiais',      'access_materials'],
  ['/cadastros',      'access_cadastros'],
  ['/users',          'access_administracao'],
  ['/holerites',      'access_administracao'],
  ['/analysis',       'access_administracao'],
  ['/notifications',  'access_administracao'],
  ['/configuracoes',  'access_administracao'],
  ['/calendar',       'access_comercial'],
  ['/orcamentos',     'access_comercial'],
  ['/events',         'access_comercial'],
  ['/clients',        'access_comercial'],
  ['/tastings',       'access_comercial'],
  ['/event-menus',    'access_estoque'],
  ['/sheets',         'access_estoque'],
  ['/shopping-lists', 'access_estoque'],
  ['/items',          'access_estoque'],
  ['/inventory',      'access_estoque'],
  ['/entries',        'access_estoque'],
  ['/outputs',        'access_estoque'],
  ['/batch-movement', 'access_estoque'],
  ['/transfers',      'access_estoque'],
  ['/fornecedores',   'access_estoque'],
  ['/categories',     'access_estoque'],
  ['/tags',           'access_estoque'],
  ['/kitchens',       'access_estoque'],
];

function requiredPermFor(pathname: string): keyof Permissions | null {
  const hit = ROUTE_PERMS.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix + '/'));
  return hit ? hit[1] : null;
}

/**
 * Bloqueia o acesso direto por URL a rotas que o usuário não tem permissão.
 * Admins (is_admin) passam por tudo. Rotas sem mapeamento (Dashboard, Meu Perfil,
 * Meus Holerites, Comparativo) são sempre liberadas.
 */
export default function SupervisorRouteGuard({ children }: { children: ReactNode }) {
  const { permissions, role, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading) return null;
  if (permissions.is_admin || role === 'supervisor') return <>{children}</>;

  const perm = requiredPermFor(pathname);
  if (perm && !permissions[perm]) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
