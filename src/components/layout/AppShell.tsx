import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../store/useAuth';
import { useProfile } from '../../store/useProfile';

const NAV = [
  { to: '/', label: 'Painel', icon: '📊' },
  { to: '/movimentos', label: 'Movimentos', icon: '🏦' },
  { to: '/faturas', label: 'Faturas', icon: '🧾' },
  { to: '/previsao', label: 'Previsão', icon: '📅' },
  { to: '/calendario', label: 'Calendário fiscal', icon: '🗓️' },
  { to: '/cfo', label: 'CFO virtual', icon: '🤖' },
  { to: '/definicoes', label: 'Definições', icon: '⚙️' },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`
          }
        >
          <span aria-hidden>{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell() {
  const profile = useProfile((s) => s.profile);
  const logout = useAuth((s) => s.logout);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-full">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-1">
          <img src="/favicon.svg" alt="" className="size-8" />
          <div>
            <div className="text-sm font-bold text-brand-800">Assistente CFO</div>
            <div className="max-w-36 truncate text-xs text-slate-500">{profile?.name}</div>
          </div>
        </div>
        <NavItems />
        <div className="mt-auto pt-4">
          <button
            onClick={() => void logout()}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-100"
          >
            Terminar sessão
          </button>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior (mobile) */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="" className="size-7" />
            <span className="text-sm font-bold text-brand-800">Assistente CFO</span>
          </div>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            aria-label="Menu"
          >
            ☰
          </button>
        </header>
        {menuOpen && (
          <div className="border-b border-slate-200 bg-white p-3 md:hidden">
            <NavItems onNavigate={() => setMenuOpen(false)} />
            <button
              onClick={() => void logout()}
              className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-100"
            >
              Terminar sessão
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
