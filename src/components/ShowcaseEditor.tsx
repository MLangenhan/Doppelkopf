import { ACHIEVEMENT_BY_KEY, TITLES } from '@engine';
import { Check, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorMessage, supabase } from '../lib/supabase';
import { AchievementBadge } from './AchievementBadge';
import { TitleTag } from './Showcase';
import { useToast } from './Toast';

/** Vitrine (bis zu 3 Erfolge), Titel wählen, Titel kaufen, Anzeige an/aus */
export function ShowcaseEditor({ me, earned, points }: { me: string; earned: string[]; points: number }) {
  const toast = useToast();
  const [owned, setOwned] = useState<string[]>([]);
  const [badges, setBadges] = useState<string[]>([]);
  const [title, setTitle] = useState<string | null>(null);
  const [showBadges, setShowBadges] = useState(true);
  const [showTitle, setShowTitle] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: t }] = await Promise.all([
        supabase.from('profiles').select('showcase, title, show_badges, show_title').eq('id', me).single(),
        supabase.from('user_titles').select('key').eq('user_id', me),
      ]);
      if (p) {
        setBadges((p.showcase as string[]) ?? []);
        setTitle((p.title as string | null) ?? null);
        setShowBadges(p.show_badges !== false);
        setShowTitle(p.show_title !== false);
      }
      setOwned((t ?? []).map((r) => r.key as string));
    })();
  }, [me]);

  const spent = TITLES.filter((t) => owned.includes(t.key)).reduce((s, t) => s + t.cost, 0);
  const free = points - spent;

  const save = async (next: { badges?: string[]; title?: string | null; showBadges?: boolean; showTitle?: boolean }) => {
    const v = { badges, title, showBadges, showTitle, ...next };
    setBadges(v.badges);
    setTitle(v.title);
    setShowBadges(v.showBadges);
    setShowTitle(v.showTitle);
    const { error } = await supabase.rpc('set_showcase', {
      p_badges: v.badges,
      p_title: v.title,
      p_show_badges: v.showBadges,
      p_show_title: v.showTitle,
    });
    if (error) toast(await errorMessage(error), 'error');
  };

  const buy = async (key: string) => {
    setBusy(true);
    const { error } = await supabase.rpc('buy_title', { p_key: key });
    setBusy(false);
    if (error) {
      toast(await errorMessage(error), 'error');
      return;
    }
    setOwned((o) => [...o, key]);
    toast('Titel gekauft', 'success');
    if (!title) void save({ title: key });
  };

  const toggleBadge = (key: string) => {
    const next = badges.includes(key) ? badges.filter((b) => b !== key) : badges.length < 3 ? [...badges, key] : badges;
    void save({ badges: next });
  };

  return (
    <section className="mt-10 border-t border-white/[0.08] pt-6">
      <h2 className="tag mb-1 text-[11px] text-white/60">Vitrine & Titel</h2>
      <p className="mb-4 text-sm text-white/50">
        Erscheinen neben deinem Namen an der Kamera, in der Lobby und in der Statistik.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <label className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Badges (bis zu 3)</span>
            <span className="flex items-center gap-2 text-white/60">
              anzeigen
              <input type="checkbox" checked={showBadges} onChange={(e) => void save({ showBadges: e.target.checked })} className="accent-gold-400" />
            </span>
          </label>
          {earned.length === 0 ? (
            <p className="text-sm text-white/40">Noch keine Erfolge – die ersten kommen beim nächsten Spiel.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {earned.map((k) => {
                const on = badges.includes(k);
                return (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => toggleBadge(k)}
                      aria-pressed={on}
                      title={ACHIEVEMENT_BY_KEY.get(k)?.name}
                      className={`relative rounded-xl p-1.5 transition ${on ? 'bg-gold-400/20 ring-2 ring-gold-400' : 'bg-white/[0.04] hover:bg-white/10'}`}
                    >
                      <AchievementBadge achievementKey={k} size={44} />
                      {on && <Check className="absolute -top-1 -right-1 size-4 rounded-full bg-gold-400 p-0.5 text-felt-950" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <label className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">
              Titel · <span className="text-gold-300 tabular-nums">{free}</span> Punkte frei
            </span>
            <span className="flex items-center gap-2 text-white/60">
              anzeigen
              <input type="checkbox" checked={showTitle} onChange={(e) => void save({ showTitle: e.target.checked })} className="accent-gold-400" />
            </span>
          </label>
          <ul className="grid gap-1.5">
            {TITLES.map((t) => {
              const has = owned.includes(t.key);
              const active = title === t.key;
              return (
                <li key={t.key} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${t.rare ? 'bg-sky-400/[0.06]' : 'bg-white/[0.03]'}`}>
                  <span className="min-w-0 flex-1">
                    <TitleTag titleKey={t.key} className="text-[11px]" />
                  </span>
                  {has ? (
                    <button
                      type="button"
                      className={`btn-ghost tag px-2 py-1 text-[10px] ${active ? 'text-gold-300' : ''}`}
                      onClick={() => void save({ title: active ? null : t.key })}
                    >
                      {active ? 'Gewählt' : 'Wählen'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary tag px-2 py-1 text-[10px]"
                      disabled={busy || free < t.cost}
                      onClick={() => void buy(t.key)}
                    >
                      {free < t.cost && <Lock className="size-3" />}
                      {t.cost} Punkte
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
