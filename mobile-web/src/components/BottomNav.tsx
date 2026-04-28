import { Calendar, Home, List, UtensilsCrossed } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/',            label: 'Início',  Icon: Home            },
  { to: '/eventos',     label: 'Eventos', Icon: List            },
  { to: '/calendario',  label: 'Agenda',  Icon: Calendar        },
  { to: '/degustacoes', label: 'Degust.', Icon: UtensilsCrossed },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe pb-3">
      <div className="max-w-lg mx-auto">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/15 border border-white flex p-1.5">
          {TABS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className="flex-1"
            >
              {({ isActive }) => (
                <div className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-2xl transition-all ${
                  isActive ? 'bg-ron-900' : ''
                }`}>
                  <Icon className={`w-5 h-5 transition-all ${
                    isActive ? 'text-white stroke-[2.5]' : 'text-gray-400'
                  }`} />
                  <span className={`text-[10px] font-semibold transition-all ${
                    isActive ? 'text-white' : 'text-gray-400'
                  }`}>
                    {label}
                  </span>
                </div>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
