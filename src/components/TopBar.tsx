import { BarChart3, LogOut, Settings } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { SettingsDialog } from './SettingsDialog';
import { StatsDialog } from './StatsDialog';

export function TopBar({ children }: { children?: ReactNode }) {
  const { profile, session } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  // Im Spiel öffnet die Statistik als Popup, damit man nicht vom Tisch weg muss
  const { pathname } = useLocation();
  const inGame = pathname.startsWith('/t/') || pathname.startsWith('/uebung');
  const statsClass = 'btn-ghost tag p-2 text-[11px] sm:px-3 sm:py-1.5';
  const statsLabel = (
    <>
      <BarChart3 className="size-5 sm:hidden" />
      <span className="hidden sm:inline">Statistik</span>
    </>
  );
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 px-3 sm:gap-3 sm:px-4">
      <Link to="/" className="flex items-center gap-2 text-white">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="Doppelkopf" className="h-6 w-6" />
        <span className="display hidden text-2xl sm:inline">Doppelkopf</span>
      </Link>
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">{children}</div>
      <button className="btn-ghost p-2" onClick={() => setSettingsOpen(true)} aria-label="Einstellungen" title="Einstellungen">
        <Settings className="h-5 w-5" />
      </button>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <StatsDialog open={statsOpen} onClose={() => setStatsOpen(false)} />
      {session ? (
        <nav className="flex shrink-0 items-center gap-1">
          {inGame ? (
            <button className={statsClass} onClick={() => setStatsOpen(true)} aria-label="Statistik">
              {statsLabel}
            </button>
          ) : (
            <Link to="/statistik" className={statsClass} aria-label="Statistik">
              {statsLabel}
            </Link>
          )}
          <span className="tag hidden px-2 text-[11px] text-white/45 md:inline">{profile?.display_name}</span>
          <button
            className="btn-ghost tag p-2 text-[11px] sm:px-3 sm:py-1.5"
            onClick={() => supabase.auth.signOut()}
            aria-label="Abmelden"
          >
            <LogOut className="size-5 sm:hidden" />
            <span className="hidden sm:inline">Abmelden</span>
          </button>
        </nav>
      ) : (
        <Link to="/login" className="btn-ghost tag px-3 py-1.5 text-[11px]">
          Anmelden
        </Link>
      )}
    </header>
  );
}
