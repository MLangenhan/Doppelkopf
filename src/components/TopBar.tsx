import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

export function TopBar({ children }: { children?: ReactNode }) {
  const { profile, session } = useAuth();
  return (
    <header className="flex h-14 items-center gap-3 border-b border-white/10 bg-felt-950/60 px-4 backdrop-blur-md">
      <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold text-gold-300">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-7 w-7" />
        <span className="hidden sm:inline">Doppelkopf</span>
      </Link>
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
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
