import { DEFAULT_SETTINGS, normalizeSettings, type RuleSettings } from '@engine';
import { AnimatePresence, motion } from 'motion/react';
import { type FormEvent, lazy, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import { RulesForm } from '../components/RulesForm';
import { arrowLink, SectionLabel } from '../components/SectionLabel';
import { useToast } from '../components/Toast';
import { TopBar } from '../components/TopBar';
import { useAuth } from '../lib/auth';
import { useEffectsEnabled } from '../lib/prefs';
import { api, supabase, type TableRow } from '../lib/supabase';

// three.js nur laden, wenn die 3D-Szene wirklich gezeigt wird
const CardScene = lazy(() => import('../components/CardScene'));

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
  const effects = useEffectsEnabled();
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
      <section className="relative isolate overflow-hidden">
        {effects && (
          <div className="absolute inset-0 -z-10">
            <Suspense fallback={null}>
              <CardScene variant="banner" />
            </Suspense>
            {/* Links bleibt der Text auf ruhigem Grund */}
            <div className="absolute inset-0 bg-gradient-to-r from-felt-900 via-felt-900/80 to-transparent" />
          </div>
        )}
        <div className="mx-auto flex min-h-56 max-w-5xl flex-col justify-center px-4 py-10">
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="display text-6xl text-white sm:text-8xl"
          >
            Hallo {profile?.display_name ?? ''}
          </motion.h1>
          <p className="tag mt-3 max-w-md text-[11px] text-white/55">Eröffne einen Tisch und schick den Link an deine Runde.</p>
        </div>
      </section>
      <main className="mx-auto max-w-5xl px-4 pb-20">
        <section className="grid gap-12 border-t border-white/[0.08] py-10 lg:grid-cols-[1fr_17rem]">
          <form onSubmit={create}>
            <SectionLabel n="01">Neuer Tisch</SectionLabel>
            <div className="flex items-end gap-4 border-b border-white/15 transition-colors focus-within:border-gold-400">
              <input
                className="min-w-0 flex-1 bg-transparent py-3 text-2xl text-white outline-none placeholder:text-white/25"
                placeholder="Name des Abends"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                aria-label="Name des Abends (optional)"
              />
              <button className="btn-primary mb-2 shrink-0" disabled={busy}>
                Tisch eröffnen <ArrowRight className="size-4" />
              </button>
            </div>
            <button
              type="button"
              className={`${arrowLink} mt-4 flex items-center gap-2`}
              onClick={() => setShowRules((v) => !v)}
              aria-expanded={showRules}
            >
              <Plus className={`size-3.5 transition-transform ${showRules ? 'rotate-45' : ''}`} />
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
                  <div className="pt-6">
                    <RulesForm value={rules} onChange={setRules} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          <form onSubmit={join}>
            <SectionLabel n="02">Beitreten</SectionLabel>
            <div className="flex items-end gap-3 border-b border-white/15 transition-colors focus-within:border-gold-400">
              <input
                className="tag min-w-0 flex-1 bg-transparent py-3 text-2xl tracking-[0.3em] text-white outline-none placeholder:text-white/25"
                placeholder="CODE"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                aria-label="Tisch-Code oder Einladungslink"
              />
              <button className="btn-ghost mb-2 p-2" disabled={!code.trim()} aria-label="Beitreten" data-cursor="Beitreten">
                <ArrowRight className="size-5" />
              </button>
            </div>
            <p className="mt-3 text-sm text-white/45">Code oder ganzen Einladungslink einfügen.</p>
            <Link to="/uebung" className={`${arrowLink} mt-6 inline-flex items-center gap-2`}>
              Alleine üben gegen Bots <ArrowRight className="size-3.5" />
            </Link>
          </form>
        </section>

        <section className="border-t border-white/[0.08] py-10">
          <SectionLabel
            n="03"
            action={
              <Link to="/statistik" className={`${arrowLink} inline-flex items-center gap-2`}>
                Statistik <ArrowRight className="size-3.5" />
              </Link>
            }
          >
            Deine Abende
          </SectionLabel>
          {recent === null ? (
            <p className="tag text-[11px] text-white/40">Lädt …</p>
          ) : recent.length === 0 ? (
            <p className="text-white/50">Noch keine Abende. Eröffne den ersten Tisch.</p>
          ) : (
            <ul className="border-t border-white/[0.08]">
              {recent.map((t) => (
                <li key={t.id}>
                  <Link
                    to={`/t/${t.code}`}
                    data-cursor="Öffnen"
                    className="group grid grid-cols-[6.5rem_1fr_auto] items-baseline gap-4 border-b border-white/[0.08] py-4 transition-colors hover:bg-white/[0.03] sm:grid-cols-[7rem_1fr_1fr_auto]"
                  >
                    <span className="tag text-[11px] text-white/40">
                      {new Date(t.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </span>
                    <span className="truncate text-lg font-medium transition-colors group-hover:text-gold-300">{t.name}</span>
                    <span className="hidden truncate text-sm text-white/45 sm:block">{t.players.join(' · ')}</span>
                    <span className="tag flex items-center gap-2 text-[11px] text-white/35">
                      {t.code}
                      <ArrowRight className="size-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
