import type { ReactNode } from 'react'
import { NavLink, Link } from 'react-router-dom'
import OnlineStatus from './OnlineStatus'

const NAV = [
  { to: '/', label: 'Tableau de bord', icone: 'M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10' },
  { to: '/chantiers', label: 'Chantiers', icone: 'M4 21V8l8-5 8 5v13M9 21v-6h6v6M2 21h20' },
  { to: '/sauvegarde', label: 'Sauvegarde', icone: 'M12 3v12m0-12l-4 4m4-4l4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2' },
  { to: '/parametres', label: 'Paramètres', icone: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 01-.1 1.2l2 1.6-2 3.4-2.4-1a7 7 0 01-2 1.2L14 21h-4l-.5-2.6a7 7 0 01-2-1.2l-2.4 1-2-3.4 2-1.6A7 7 0 015 12a7 7 0 01.1-1.2l-2-1.6 2-3.4 2.4 1a7 7 0 012-1.2L10 3h4l.5 2.6a7 7 0 012 1.2l2.4-1 2 3.4-2 1.6c.06.4.1.8.1 1.2z' }
]

function Ic({ path, active }: { path: string; active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d={path} />
    </svg>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      {/* Barre latérale (ordinateur / tablette paysage) */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 bg-marque-800 text-white z-20">
        <Link to="/" className="flex items-center gap-2 px-5 py-5 border-b border-marque-700">
          <img src="icons/icon-192.png" alt="" className="h-9 w-9 rounded-lg" />
          <div>
            <div className="font-bold leading-tight">PV Chantier</div>
            <div className="text-xs text-marque-200">Étanchéité ouvrages d'art</div>
          </div>
        </Link>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                  isActive ? 'bg-marque-700 text-white' : 'text-marque-100 hover:bg-marque-700/60'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Ic path={n.icone} active={isActive} />
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-marque-700 text-xs text-marque-200 space-y-2">
          <OnlineStatus />
          <p>Données stockées localement sur cet appareil. Aucune connexion requise.</p>
        </div>
      </aside>

      <div className="md:pl-60 flex flex-col min-h-screen flex-1">
        {/* Barre haute (mobile / tablette) */}
        <header className="md:hidden sticky top-0 z-20 bg-marque-800 text-white px-4 py-3 flex items-center justify-between shadow">
          <Link to="/" className="flex items-center gap-2">
            <img src="icons/icon-192.png" alt="" className="h-8 w-8 rounded" />
            <span className="font-bold">PV Chantier</span>
          </Link>
          <OnlineStatus />
        </header>

        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 max-w-6xl w-full mx-auto">{children}</main>

        {/* Navigation basse (mobile / tablette) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-slate-200 grid grid-cols-4 safe-area-bottom">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                  isActive ? 'text-marque-700' : 'text-slate-500'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Ic path={n.icone} active={isActive} />
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
