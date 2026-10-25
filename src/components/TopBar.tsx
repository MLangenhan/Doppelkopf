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
    <header className="flex h-14 items-center gap-3 border-b border-white/10 bg-felt-950 px-4">
      <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-7 w-7" />
        <span className="hidden sm:inline">Doppelkopf</span>
      </Link>
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
      <button className="btn-ghost p-2" onClick={() => setSettingsOpen(true)} aria-label="Einstellungen" title="Einstellungen">
        <Settings className="h-5 w-5" />
      </button>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {session ? (
        <nav className="flex items-center gap-1">
          <Link to="/statistik" className="btn-ghost px-3 py-1.5">
            Statistik
          </Link>
          <span className="hidden px-2 text-sm text-white/60 md:inline">{profile?.display_name}</span>
          <button className="btn-ghost px-3 py-1.5" onClick={() => supabase.auth.signOut()}>
            Abmelden
          </button>
        </nav>
      ) : (
        <Link to="/login" className="btn-ghost px-3 py-1.5">
          Anmelden
        </Link>
      )}
    </header>
  );
}
