import { BarChart2, Calendar, Home, List, UtensilsCrossed } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/',             label: 'Início',    Icon: Home           },
  { to: '/eventos',      label: 'Eventos',   Icon: List           },
  { to: '/calendario',   label: 'Agenda',    Icon: Calendar       },
  { to: '/degustacoes',  label: 'Degust.',   Icon: UtensilsCrossed },
  { to: '/estatisticas', label: 'Stats',     Icon: BarChart2      },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 z-50 pb-safe">
      <div className="flex max-w-lg mx-auto">
        {TABS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                isActive ? 'text-amber-800' : 'text-stone-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
