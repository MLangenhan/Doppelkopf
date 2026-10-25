import { DEFAULT_SETTINGS, normalizeSettings, type RuleSettings } from '@engine';
import { AnimatePresence, motion } from 'motion/react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RulesForm } from '../components/RulesForm';
import { useToast } from '../components/Toast';
import { TopBar } from '../components/TopBar';
import { useAuth } from '../lib/auth';
import { api, supabase, type TableRow } from '../lib/supabase';

const RULES_KEY = 'doko:lastRules';

function loadRules(): RuleSettings {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (raw) return normalizeSettings(JSON.parse(raw));
  } catch {
    // ignorieren
  }
  return DEFAULT_SETTINGS;
}

interface RecentTable extends TableRow {
  players: string[];
}

export function HomePage() {
  const { profile, session } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [rules, setRules] = useState<RuleSettings>(loadRules);
  const [name, setName] = useState('');
  const [showRules, setShowRules] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<RecentTable[] | null>(null);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data: mine } = await supabase.from('table_players').select('table_id').eq('user_id', session.user.id);
      const ids = (mine ?? []).map((m) => m.table_id as string);
      if (!ids.length) {
        setRecent([]);
        return;
      }
      const { data: tables } = await supabase
        .from('tables')
        .select('*, table_players(profiles(display_name))')
        .in('id', ids)
        .order('created_at', { ascending: false })
        .limit(8);
      setRecent(
        (tables ?? []).map((t) => ({
          ...(t as TableRow),
          players: ((t.table_players ?? []) as { profiles: { display_name: string } | null }[]).map(
            (p) => p.profiles?.display_name ?? '?',
          ),
        })),
      );
    })();
  }, [session]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      try {
        localStorage.setItem(RULES_KEY, JSON.stringify(rules));
      } catch {
        // ignorieren
      }
      const t = await api.createTable(rules, name);
      navigate(`/t/${t.code}`);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  function join(e: FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    // Ganze Einladungslinks akzeptieren
    const fromLink = c.match(/\/T\/([A-Z0-9]+)/)?.[1];
    if (fromLink || c) navigate(`/t/${fromLink ?? c}`);
  }

  return (
    <div className="felt min-h-full">
      <TopBar />
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-16">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-3xl font-bold text-white sm:text-4xl"
        >
          Hallo {profile?.display_name ?? ''} 👋
        </motion.h1>
        <p className="mt-1 text-white/65">Eröffne einen Tisch und schick den Link an deine Runde.</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem]">
          <motion.form
            onSubmit={create}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="panel p-6"
          >
            <h2 className="text-lg font-semibold">Neuer Tisch</h2>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                className="input"
                placeholder="Name des Abends (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                aria-label="Name des Abends"
              />
              <button className="btn-primary shrink-0 px-6" disabled={busy}>
                Tisch eröffnen
              </button>
            </div>
            <button
              type="button"
              className="mt-4 flex items-center gap-2 text-sm font-medium text-gold-300 hover:text-gold-400"
              onClick={() => setShowRules((v) => !v)}
              aria-expanded={showRules}
            >
              <motion.span animate={{ rotate: showRules ? 90 : 0 }} className="inline-block">
                ▸
              </motion.span>
              Hausregeln anpassen
            </button>
            <AnimatePresence initial={false}>
              {showRules && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4">
                    <RulesForm value={rules} onChange={setRules} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.form>

          <motion.form
            onSubmit={join}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="panel h-fit p-6"
          >
            <h2 className="text-lg font-semibold">Tisch beitreten</h2>
            <p className="mt-1 text-sm text-white/60">Code oder Einladungslink eingeben</p>
            <input
              className="input mt-4 text-center font-mono text-lg tracking-[0.3em] uppercase"
              placeholder="ABC12"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-label="Tisch-Code"
            />
            <button className="btn-secondary mt-3 w-full" disabled={!code.trim()}>
              Beitreten
            </button>
            <div className="mt-5 border-t border-white/10 pt-4">
              <Link to="/uebung" className="text-sm font-medium text-gold-300 hover:text-gold-400">
                Alleine üben gegen Bots →
              </Link>
            </div>
          </motion.form>
        </div>

        <section className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Deine Abende</h2>
            <Link to="/statistik" className="text-sm font-medium text-gold-300 hover:text-gold-400">
              Statistik ansehen →
            </Link>
          </div>
          {recent === null ? (
            <p className="mt-4 text-white/50">Lädt …</p>
          ) : recent.length === 0 ? (
            <p className="mt-4 text-white/50">Noch keine Abende – eröffne den ersten Tisch!</p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {recent.map((t, i) => (
                <motion.li
                  key={t.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03 * i }}
                >
                  <Link
                    to={`/t/${t.code}`}
                    className="panel block p-4 transition hover:border-gold-400/50 hover:bg-felt-900/80"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{t.name}</span>
                      <span className="font-mono text-xs text-white/50">{t.code}</span>
                    </div>
                    <div className="mt-1 text-sm text-white/60">
                      {new Date(t.created_at).toLocaleDateString('de-DE', {
                        weekday: 'short',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}{' '}
                      · {t.players.join(', ')}
                    </div>
                  </Link>
                </motion.li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
