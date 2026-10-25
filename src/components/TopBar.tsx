import { Settings } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { SettingsDialog } from './SettingsDialog';

export function TopBar({ children }: { children?: ReactNode }) {
  const { profile, session } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <header className="flex h-14 items-center gap-3 px-4">
      <Link to="/" className="flex items-center gap-2 text-white">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-6 w-6" />
        <span className="display hidden text-2xl sm:inline">Doppelkopf</span>
      </Link>
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
      <button className="btn-ghost p-2" onClick={() => setSettingsOpen(true)} aria-label="Einstellungen" title="Einstellungen">
        <Settings className="h-5 w-5" />
      </button>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {session ? (
        <nav className="flex items-center gap-1">
          <Link to="/statistik" className="btn-ghost tag px-3 py-1.5 text-[11px]">
            Statistik
          </Link>
          <span className="tag hidden px-2 text-[11px] text-white/45 md:inline">{profile?.display_name}</span>
          <button className="btn-ghost tag px-3 py-1.5 text-[11px]" onClick={() => supabase.auth.signOut()}>
            Abmelden
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
