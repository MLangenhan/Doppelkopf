import { motion } from 'motion/react';
import { type FormEvent, lazy, Suspense, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { PlayingCard } from '../components/PlayingCard';
import { useAuth } from '../lib/auth';
import { useEffectsEnabled } from '../lib/prefs';
import { errorMessage, supabase } from '../lib/supabase';

// three.js nur laden, wenn die 3D-Szene wirklich gezeigt wird
const CardScene = lazy(() => import('../components/CardScene'));

const HERO = ['H-10-0', 'C-Q-0', 'S-Q-0', 'D-A-0', 'C-J-0'];

export function LoginPage() {
  const { session } = useAuth();
  const effects = useEffectsEnabled();
  const location = useLocation();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? '/';
  if (session) return <Navigate to={from} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: window.location.href.split('#')[0],
          },
        });
        if (error) throw error;
        if (!data.session) setInfo('Fast geschafft! Bitte bestätige deine E-Mail-Adresse über den Link, den wir dir geschickt haben.');
      }
    } catch (err) {
      const msg = await errorMessage(err);
      setError(
        msg === 'Invalid login credentials'
          ? 'E-Mail oder Passwort stimmt nicht.'
          : msg === 'User already registered'
            ? 'Mit dieser E-Mail gibt es schon ein Konto.'
            : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="felt relative isolate flex min-h-full flex-col items-center justify-center gap-10 px-4 py-10">
      {effects && (
        <div className="fixed inset-0 -z-10">
          <Suspense fallback={null}>
            <CardScene variant="hero" />
          </Suspense>
          {/* Schleier zur Mitte: Text und Formular bleiben immer gut lesbar */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_32rem_30rem_at_center,var(--color-felt-900)_35%,transparent_100%)] opacity-90" />
        </div>
      )}
      <div className="flex flex-col items-center gap-6">
        {!effects && (
          <div className="mb-4 flex h-36 items-end" aria-hidden>
            {HERO.map((c, i) => (
              <PlayingCard
                key={c}
                card={c}
                width={84}
                className="-mx-3"
                initial={{ opacity: 0, y: 60, rotate: 0 }}
                animate={{ opacity: 1, y: Math.abs(i - 2) * 10, rotate: (i - 2) * 9 }}
                transition={{ delay: 0.15 + i * 0.08, type: 'spring', stiffness: 160, damping: 18 }}
                style={{ transformOrigin: '50% 120%' }}
              />
            ))}
          </div>
        )}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="display text-7xl text-white sm:text-9xl"
        >
          Doppelkopf
        </motion.h1>
        <p className="tag -mt-2 text-[11px] text-white/55">Mit Freunden spielen · von überall · mit Kamera</p>
      </div>

      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="panel w-full max-w-sm space-y-4 p-6"
      >
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/30 p-1" role="tablist">
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-lg py-2 text-sm font-semibold transition ${
                mode === m ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              {m === 'login' ? 'Anmelden' : 'Registrieren'}
            </button>
          ))}
        </div>

        {mode === 'signup' && (
          <div>
            <label className="label" htmlFor="name">
              Name am Tisch
            </label>
            <input
              id="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              required
              autoComplete="nickname"
              placeholder="z. B. Max"
            />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">
            E-Mail
          </label>
          <input
            id="email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Passwort
          </label>
          <input
            id="password"
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>

        {error && <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</p>}
        {info && <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">{info}</p>}

        <button className="btn-primary w-full py-3" disabled={busy}>
          {busy ? 'Einen Moment …' : mode === 'login' ? 'Anmelden' : 'Konto erstellen'}
        </button>
      </motion.form>
      <Link to="/uebung" className="-mt-4 text-sm font-medium text-gold-300 hover:text-gold-400">
        Ohne Konto ausprobieren: Übungsspiel gegen Bots →
      </Link>
    </div>
  );
}
