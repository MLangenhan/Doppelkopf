import {
  ACHIEVEMENT_BY_KEY,
  ACHIEVEMENTS,
  type AchievementDef,
  achievementPoints,
  achievementProgress,
  RARITIES,
  type Rarity,
  type ResultLite,
  TITLES,
} from '@engine';
import { Check, Lock, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { AchievementBadge } from '../components/AchievementBadge';
import { Nametag } from '../components/Nametag';
import { TitleTag } from '../components/Showcase';
import { useToast } from '../components/Toast';
import { TopBar } from '../components/TopBar';
import { VideoTile } from '../components/VideoTile';
import { useAuth } from '../lib/auth';
import { AVATAR_COLORS, AVATARS, type FrameKey, FRAME_STYLE, FRAMES } from '../lib/cosmetics';
import { errorMessage, supabase } from '../lib/supabase';

interface Earned {
  user_id: string;
  key: string;
  earned_at: string;
}

interface Look {
  badges: string[];
  title: string | null;
  showBadges: boolean;
  showTitle: boolean;
  frame: FrameKey | null;
  avatar: string | null;
  avatarColor: string | null;
}

const ORDER: Rarity[] = ['mythic', 'legendary', 'epic', 'rare', 'common'];
const RESULT_COLS = 'user_id, game_id, table_id, points, won, kind, solo, is_soloist, created_at';

const RARITY_TEXT: Record<Rarity, string> = {
  common: 'text-amber-500',
  rare: 'text-slate-200',
  epic: 'text-yellow-300',
  legendary: 'text-sky-300',
  mythic: 'text-fuchsia-300',
};
const RARITY_BG: Record<Rarity, string> = {
  common: 'from-amber-900/20',
  rare: 'from-slate-400/10',
  epic: 'from-yellow-600/15',
  legendary: 'from-sky-500/15 via-fuchsia-500/5',
  mythic: 'from-purple-700/25 via-black/10',
};

type Tab = 'erfolge' | 'vitrine' | 'shop';

/** Trophäenschrank: Vorschau des Namensschilds, Erfolge, Vitrine und Titel-Shop */
export function AchievementsContent() {
  const { session, profile } = useAuth();
  const me = session?.user.id ?? null;
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('erfolge');
  const [all, setAll] = useState<Earned[] | null>(null);
  const [names, setNames] = useState(new Map<string, string>());
  const [players, setPlayers] = useState(0);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [owned, setOwned] = useState<string[]>([]);
  const [look, setLook] = useState<Look>({ badges: [], title: null, showBadges: true, showTitle: true, frame: null, avatar: null, avatarColor: null });
  const [peekTitle, setPeekTitle] = useState<string | null>(null);
  const [filter, setFilter] = useState<'alle' | 'frei' | 'fehlt'>('alle');
  const [detail, setDetail] = useState<AchievementDef | null>(null);

  useEffect(() => {
    if (!me) return;
    (async () => {
      const [{ data: earned }, { count }, { data: mine }, { data: fox }, { data: profs }, { data: titles }] = await Promise.all([
        supabase.from('user_achievements').select('user_id, key, earned_at'),
        supabase.from('player_stats').select('user_id', { count: 'exact', head: true }).gt('games', 0),
        supabase.from('game_results').select(RESULT_COLS).eq('user_id', me).order('created_at'),
        supabase.from('user_counters').select('value').eq('user_id', me).eq('key', 'fox').maybeSingle(),
        supabase.from('profiles').select('id, display_name, showcase, title, show_badges, show_title, frame, avatar, avatar_color'),
        supabase.from('user_titles').select('key').eq('user_id', me),
      ]);
      setAll((earned ?? []) as Earned[]);
      setPlayers(count ?? 0);
      setNames(new Map((profs ?? []).map((p) => [p.id as string, p.display_name as string])));
      setOwned((titles ?? []).map((t) => t.key as string));
      const p = (profs ?? []).find((x) => x.id === me);
      if (p) {
        setLook({
          badges: (p.showcase as string[]) ?? [],
          title: (p.title as string | null) ?? null,
          showBadges: p.show_badges !== false,
          showTitle: p.show_title !== false,
          frame: (p.frame as FrameKey | null) ?? null,
          avatar: (p.avatar as string | null) ?? null,
          avatarColor: (p.avatar_color as string | null) ?? null,
        });
      }
      const rows = (mine ?? []) as ResultLite[];
      const tableIds = [...new Set(rows.map((r) => r.table_id))];
      const { data: tables } = tableIds.length ? await supabase.from('game_results').select(RESULT_COLS).in('table_id', tableIds) : { data: [] };
      setProgress(achievementProgress(me, { mine: rows, tables: (tables ?? []) as ResultLite[], foxes: fox?.value ?? 0 }));
    })();
  }, [me]);

  const mineEarned = useMemo(() => new Map((all ?? []).filter((e) => e.user_id === me).map((e) => [e.key, e])), [all, me]);
  const holders = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of all ?? []) m.set(e.key, [...(m.get(e.key) ?? []), e.user_id]);
    return m;
  }, [all]);
  const points = achievementPoints(mineEarned.keys());
  const spent = TITLES.filter((t) => owned.includes(t.key)).reduce((s, t) => s + t.cost, 0);
  const free = points - spent;
  const rarityDone = (r: Rarity) => [...mineEarned.keys()].some((k) => ACHIEVEMENT_BY_KEY.get(k)?.rarity === r);

  // Speichern: Vitrine/Titel und Rahmen/Avatar getrennt, jeweils mit Prüfung in der Datenbank
  const save = async (next: Partial<Look>) => {
    const v = { ...look, ...next };
    setLook(v);
    const showcaseChanged = 'badges' in next || 'title' in next || 'showBadges' in next || 'showTitle' in next;
    const { error } = showcaseChanged
      ? await supabase.rpc('set_showcase', { p_badges: v.badges, p_title: v.title, p_show_badges: v.showBadges, p_show_title: v.showTitle })
      : await supabase.rpc('set_cosmetics', { p_frame: v.frame, p_avatar: v.avatar, p_avatar_color: v.avatarColor });
    if (error) toast(await errorMessage(error), 'error');
  };
  const buy = async (key: string) => {
    const { error } = await supabase.rpc('buy_title', { p_key: key });
    if (error) return toast(await errorMessage(error), 'error');
    setOwned((o) => [...o, key]);
    toast('Titel gekauft', 'success');
    void save({ title: key });
  };

  const close = [...ACHIEVEMENTS]
    .filter((a) => a.target && !mineEarned.has(a.key) && (progress[a.key] ?? 0) > 0)
    .sort((a, b) => (progress[b.key] ?? 0) / b.target! - (progress[a.key] ?? 0) / a.target!)
    .slice(0, 3);

  const shownTitle = peekTitle ?? (look.showTitle ? look.title : null);
  const name = profile?.display_name ?? 'Du';

  return (
    <>
      {/* Kopf: Vorschau des Namensschilds und Punkte */}
      <header className="grid gap-6 md:grid-cols-[minmax(0,20rem)_1fr] md:items-end">
        <div>
          <p className="tag mb-2 text-[10px] text-white/45">So sehen dich die anderen</p>
          <VideoTile stream={null} name={name} avatar={look.avatar} avatarColor={look.avatarColor} className="aspect-[4/3] w-full">
            <Nametag
              className="absolute bottom-2 left-2 max-w-[92%]"
              name={name}
              title={shownTitle}
              badges={look.showBadges ? look.badges : []}
              frame={look.frame}
            />
          </VideoTile>
        </div>
        <div>
          <h1 className="display text-6xl sm:text-7xl">Trophäenschrank</h1>
          <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <div className="tag text-[10px] text-white/45">Erfolgspunkte</div>
              <div className="display text-5xl text-gold-300 tabular-nums">{points}</div>
              <div className="tag text-[10px] text-white/40">{free} frei für Titel</div>
            </div>
            <ul className="flex gap-3">
              {ORDER.slice().reverse().map((r) => {
                const total = ACHIEVEMENTS.filter((a) => a.rarity === r).length;
                const done = ACHIEVEMENTS.filter((a) => a.rarity === r && mineEarned.has(a.key)).length;
                return (
                  <li key={r} className="flex flex-col items-center gap-1" title={RARITIES[r].label}>
                    <svg viewBox="0 0 36 36" className="size-12 -rotate-90">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                      <circle
                        cx="18"
                        cy="18"
                        r="15"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${(done / total) * 94.2} 94.2`}
                        className={RARITY_TEXT[r]}
                      />
                    </svg>
                    <span className="tag text-[9px] text-white/55 tabular-nums">
                      {done}/{total}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </header>

      {/* Reiter */}
      <nav className="mt-8 flex gap-1 border-b border-white/[0.08]" role="tablist">
        {(['erfolge', 'vitrine', 'shop'] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`tag -mb-px border-b-2 px-4 py-2.5 text-[11px] transition-colors ${tab === t ? 'border-gold-400 text-white' : 'border-transparent text-white/50 hover:text-white'}`}
          >
            {t === 'erfolge' ? `Erfolge ${mineEarned.size}/${ACHIEVEMENTS.length}` : t === 'vitrine' ? 'Vitrine' : 'Titel-Shop'}
          </button>
        ))}
      </nav>

      {tab === 'erfolge' && (
        <div className="pt-6">
          {close.length > 0 && (
            <section className="mb-8">
              <h2 className="tag mb-3 text-[11px] text-white/60">Fast geschafft</h2>
              <ul className="grid gap-3 sm:grid-cols-3">
                {close.map((a) => (
                  <li key={a.key}>
                    <button className="flex w-full items-center gap-3 rounded-xl bg-white/[0.04] p-3 text-left ring-1 ring-white/[0.06] hover:bg-white/[0.07]" onClick={() => setDetail(a)}>
                      <AchievementBadge achievementKey={a.key} size={48} locked />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{a.name}</span>
                        <span className="mt-1 block h-1 rounded-full bg-white/[0.08]">
                          <span className="block h-full rounded-full bg-gold-400" style={{ width: `${((progress[a.key] ?? 0) / a.target!) * 100}%` }} />
                        </span>
                        <span className="tag text-[9px] text-white/45">
                          {progress[a.key]} / {a.target}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mb-4 flex gap-1.5">
            {(['alle', 'frei', 'fehlt'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`tag rounded-full px-3 py-1 text-[10px] ${filter === f ? 'bg-white/15 text-white' : 'bg-white/[0.04] text-white/50 hover:text-white'}`}
              >
                {f === 'alle' ? 'Alle' : f === 'frei' ? 'Freigeschaltet' : 'Fehlt noch'}
              </button>
            ))}
          </div>

          {ORDER.map((rarity) => {
            const list = ACHIEVEMENTS.filter(
              (a) => a.rarity === rarity && (filter === 'alle' || (filter === 'frei') === mineEarned.has(a.key)),
            );
            if (!list.length) return null;
            return (
              <section key={rarity} className={`mb-6 rounded-2xl bg-gradient-to-br to-transparent p-4 ${RARITY_BG[rarity]}`}>
                <h2 className="tag mb-3 flex items-center gap-3 text-[11px]">
                  <span className={RARITY_TEXT[rarity]}>{RARITIES[rarity].label}</span>
                  <span className="text-white/35">je {RARITIES[rarity].points} Punkte</span>
                </h2>
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                  {list.map((a) => {
                    const earned = mineEarned.has(a.key);
                    const hidden = a.secret && !earned && !(holders.get(a.key)?.length ?? 0);
                    return (
                      <li key={a.key}>
                        <button
                          onClick={() => setDetail(a)}
                          className="group flex w-full flex-col items-center gap-2 rounded-xl p-2 text-center transition hover:bg-white/[0.06]"
                        >
                          <span className="transition-transform group-hover:scale-110">
                            <AchievementBadge achievementKey={a.key} size={72} locked={!earned} />
                          </span>
                          <span className={`text-xs leading-tight ${earned ? 'text-white' : 'text-white/45'}`}>{hidden ? '???' : a.name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {all === null && <p className="tag text-[11px] text-white/40">Lädt …</p>}
        </div>
      )}

      {tab === 'vitrine' && (
        <div className="grid gap-8 pt-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-2 flex items-center justify-between text-sm font-medium">
              Badges (bis zu 3)
              <Switch label="anzeigen" checked={look.showBadges} onChange={(v) => void save({ showBadges: v })} />
            </h2>
            {mineEarned.size === 0 ? (
              <p className="text-sm text-white/40">Noch keine Erfolge – die ersten kommen beim nächsten Spiel.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {[...mineEarned.keys()].map((k) => {
                  const on = look.badges.includes(k);
                  return (
                    <li key={k}>
                      <button
                        onClick={() => void save({ badges: on ? look.badges.filter((b) => b !== k) : look.badges.length < 3 ? [...look.badges, k] : look.badges })}
                        aria-pressed={on}
                        title={ACHIEVEMENT_BY_KEY.get(k)?.name}
                        className={`relative rounded-xl p-1.5 transition ${on ? 'bg-gold-400/20 ring-2 ring-gold-400' : 'bg-white/[0.04] hover:bg-white/10'}`}
                      >
                        <AchievementBadge achievementKey={k} size={48} />
                        {on && <Check className="absolute -top-1 -right-1 size-4 rounded-full bg-gold-400 p-0.5 text-felt-950" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <h2 className="mt-6 mb-2 text-sm font-medium">Rahmen</h2>
            <p className="mb-2 text-xs text-white/45">Mit dem ersten Erfolg einer Stufe schaltest du ihren Rahmen frei.</p>
            <ul className="flex flex-wrap gap-2">
              <li>
                <button onClick={() => void save({ frame: null })} className={`rounded-lg px-3 py-2 text-xs ${!look.frame ? 'bg-white/15 ring-1 ring-white/40' : 'bg-white/[0.04]'}`}>
                  Ohne
                </button>
              </li>
              {FRAMES.map((f) => {
                const unlocked = rarityDone(f.rarity);
                return (
                  <li key={f.key}>
                    <button
                      disabled={!unlocked}
                      onClick={() => void save({ frame: f.key })}
                      title={unlocked ? f.name : `Freischalten mit dem ersten Erfolg der Stufe ${RARITIES[f.rarity].label}`}
                      className={`rounded-lg p-[2px] ${FRAME_STYLE[f.key]} ${look.frame === f.key ? 'ring-2 ring-white' : ''} disabled:opacity-35`}
                    >
                      <span className="flex items-center gap-1.5 rounded-md bg-felt-950 px-3 py-1.5 text-xs">
                        {!unlocked && <Lock className="size-3" />}
                        {f.name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium">Avatar (wenn die Kamera aus ist)</h2>
            <ul className="flex flex-wrap gap-1.5">
              <li>
                <button onClick={() => void save({ avatar: null })} className={`grid size-10 place-items-center rounded-full text-sm font-bold ${!look.avatar ? 'ring-2 ring-gold-400' : ''} bg-white/10`}>
                  {name.slice(0, 1).toUpperCase()}
                </button>
              </li>
              {Object.entries(AVATARS).map(([k, Icon]) => (
                <li key={k}>
                  <button onClick={() => void save({ avatar: k })} className={`grid size-10 place-items-center rounded-full bg-white/10 ${look.avatar === k ? 'ring-2 ring-gold-400' : ''}`} aria-label={k}>
                    <Icon className="size-5" />
                  </button>
                </li>
              ))}
            </ul>
            <h3 className="mt-4 mb-2 text-xs text-white/55">Farbe</h3>
            <ul className="flex flex-wrap gap-1.5">
              {AVATAR_COLORS.map((c) => (
                <li key={c}>
                  <button onClick={() => void save({ avatarColor: c })} className={`size-8 rounded-full ${look.avatarColor === c ? 'ring-2 ring-white' : ''}`} style={{ background: c }} aria-label={`Farbe ${c}`} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {tab === 'shop' && (
        <div className="pt-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-white/55">
              <span className="font-semibold text-gold-300 tabular-nums">{free}</span> Punkte frei · Fahr über einen Titel für die Vorschau oben
            </p>
            <Switch label="Titel anzeigen" checked={look.showTitle} onChange={(v) => void save({ showTitle: v })} />
          </div>
          {[true, false].map((rare) => (
            <ul key={String(rare)} className={`mb-6 grid gap-2 ${rare ? 'sm:grid-cols-3' : 'sm:grid-cols-3 lg:grid-cols-4'}`}>
              {TITLES.filter((t) => !!t.rare === rare).map((t) => {
                const has = owned.includes(t.key);
                const active = look.title === t.key;
                return (
                  <li
                    key={t.key}
                    onPointerEnter={() => setPeekTitle(t.key)}
                    onPointerLeave={() => setPeekTitle(null)}
                    className={`flex flex-col gap-3 rounded-xl p-4 ring-1 ${rare ? 'bg-gradient-to-br from-sky-400/15 to-transparent ring-sky-300/30' : 'bg-white/[0.03] ring-white/[0.06]'}`}
                  >
                    <TitleTag titleKey={t.key} className="self-start text-[11px]" />
                    {has ? (
                      <button className={`btn-ghost tag self-start px-2 py-1 text-[10px] ${active ? 'text-gold-300' : ''}`} onClick={() => void save({ title: active ? null : t.key })}>
                        {active ? 'Gewählt' : 'Wählen'}
                      </button>
                    ) : (
                      <button className="btn-secondary tag self-start px-2 py-1 text-[10px]" disabled={free < t.cost} onClick={() => void buy(t.key)}>
                        {free < t.cost && <Lock className="size-3" />}
                        {t.cost} Punkte
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          ))}
        </div>
      )}

      {/* Details zu einem Erfolg */}
      <AnimatePresence>
        {detail && (
          <motion.div
            className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDetail(null)}
          >
            <motion.div
              className="panel relative w-full max-w-sm p-6 text-center"
              initial={{ scale: 0.9, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button className="btn-ghost absolute top-2 right-2 p-1.5" onClick={() => setDetail(null)} aria-label="Schließen">
                <X className="size-5" />
              </button>
              {(() => {
                const earned = mineEarned.get(detail.key);
                const who = holders.get(detail.key) ?? [];
                const hidden = detail.secret && !earned && !who.length;
                return (
                  <>
                    <div className="mx-auto w-fit">
                      <AchievementBadge achievementKey={detail.key} size={140} locked={!earned} />
                    </div>
                    <p className={`tag mt-4 text-[10px] ${RARITY_TEXT[detail.rarity]}`}>
                      {RARITIES[detail.rarity].label} · {RARITIES[detail.rarity].points} Punkte
                    </p>
                    <h3 className="display mt-1 text-4xl">{hidden ? '???' : detail.name}</h3>
                    <p className="mt-1 text-sm text-white/65">{hidden ? 'Geheimer Erfolg – noch hat ihn niemand geschafft.' : detail.description}</p>
                    {detail.target && !earned && (
                      <p className="tag mt-3 text-[10px] text-white/50">
                        Fortschritt {Math.min(detail.target, progress[detail.key] ?? 0)} / {detail.target}
                      </p>
                    )}
                    {earned && <p className="tag mt-3 text-[10px] text-gold-300">Freigeschaltet am {new Date(earned.earned_at).toLocaleDateString('de-DE')}</p>}
                    <p className="tag mt-3 text-[10px] text-white/45">
                      {players ? `${Math.round((who.length / players) * 100)} % der Runde` : ''}
                      {who.length > 0 && ` · ${who.map((u) => names.get(u) ?? '?').join(', ')}`}
                    </p>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-white/60">
      {label}
      <input type="checkbox" className="accent-gold-400" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function AchievementsPage() {
  return (
    <div className="felt min-h-full">
      <TopBar />
      <main className="mx-auto max-w-5xl px-4 pt-4 pb-20">
        <AchievementsContent />
      </main>
    </div>
  );
}
