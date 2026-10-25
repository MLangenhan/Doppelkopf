import { useMemo, useRef, useState } from 'react';
import { resultKindLabel } from '../lib/gameText';
import { playerDetail, type Tally } from '../lib/stats';
import type { ResultRow } from '../lib/supabase';

const pct = (t: Tally) => (t.games ? Math.round((t.wins / t.games) * 100) : 0);
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const date = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });

/** Aufschlüsselung eines Spielers: Kennzahlen, Verlauf, Parteien, Spielarten, Partner. */
export function PlayerStats({ results, userId, name }: { results: ResultRow[]; userId: string; name: (id: string) => string }) {
  const d = useMemo(() => playerDetail(results, userId), [results, userId]);
  if (d.total.games === 0) return <p className="py-4 text-sm text-white/50">Noch keine Spiele.</p>;

  return (
    <div className="grid gap-8 pt-2 pb-8">
      {/* Kennzahlen */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Stat label="Siegquote" value={`${pct(d.total)} %`} sub={`${d.total.wins} von ${d.total.games}`} />
        <Stat label="Ø pro Spiel" value={(d.total.points / d.total.games).toFixed(2).replace('.', ',')} sub={`${signed(d.total.points)} gesamt`} />
        <Stat label="Längste Serie" value={String(d.streak)} sub={d.streak === 1 ? 'Sieg am Stück' : 'Siege am Stück'} />
        <Stat
          label="Bestes / schlechtestes"
          value={`${signed(d.best!.points)} / ${signed(d.worst!.points)}`}
          sub={`${resultKindLabel(d.best!.kind, d.best!.solo)}, ${date(d.best!.created_at)}`}
        />
      </dl>

      {d.timeline.length > 1 && (
        <section>
          <h4 className="tag mb-2 text-[10px] text-white/45">Punkteverlauf</h4>
          <Timeline points={d.timeline} />
        </section>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <h4 className="tag mb-3 text-[10px] text-white/45">Re und Kontra</h4>
          <div className="grid gap-3">
            {(['re', 'kontra'] as const).map((p) => {
              const t = d[p];
              return (
                <div key={p}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${p === 're' ? 'bg-re' : 'bg-kontra'}`} aria-hidden />
                      {p === 're' ? 'Re' : 'Kontra'}
                      <span className="text-white/45">{t.games} Spiele</span>
                    </span>
                    <span className="tabular-nums">
                      {pct(t)} % <span className="text-white/45">· {signed(t.points)}</span>
                    </span>
                  </div>
                  {/* Siegquote als Balken, 50 % markiert */}
                  <div className="relative mt-1.5 h-2 rounded-full bg-white/[0.06]" title={`${t.wins} von ${t.games} gewonnen`}>
                    <div
                      className={`h-full rounded-r-[4px] ${p === 're' ? 'bg-re' : 'bg-kontra'}`}
                      style={{ width: `${pct(t)}%`, borderRadius: '0 4px 4px 0' }}
                    />
                    <span className="absolute -inset-y-1 left-1/2 w-px bg-white/25" aria-hidden />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h4 className="tag mb-2 text-[10px] text-white/45">Spielarten</h4>
          <Table
            head={['Spielart', 'Spiele', 'Siege', 'Punkte']}
            rows={d.kinds.map((k) => [
              k.kind === 'solo' ? `${resultKindLabel(k.kind, k.solo)} ${k.soloist ? '(selbst)' : '(dagegen)'}` : resultKindLabel(k.kind, k.solo),
              k.tally.games,
              `${pct(k.tally)} %`,
              signed(k.tally.points),
            ])}
          />
        </section>
      </div>

      {d.partners.length > 0 && (
        <section>
          <h4 className="tag mb-2 text-[10px] text-white/45">Partner</h4>
          <div className="md:max-w-[calc(50%-1rem)]">
          <Table
            head={['Zusammen mit', 'Spiele', 'Siege', 'Punkte']}
            rows={d.partners.map((p) => [name(p.userId), p.tally.games, `${pct(p.tally)} %`, signed(p.tally.points)])}
          />
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <dt className="tag text-[10px] text-white/45">{label}</dt>
      <dd className="display mt-1 text-3xl tabular-nums sm:text-4xl">{value}</dd>
      <dd className="truncate text-xs text-white/50">{sub}</dd>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="tag text-[9px] text-white/40">
          {head.map((h, i) => (
            <th key={h} className={`pb-1.5 font-normal ${i === 0 ? 'text-left' : 'text-right'}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-white/[0.06]">
            {r.map((c, j) => (
              <td key={j} className={`py-1.5 ${j === 0 ? 'pr-2 text-left' : 'pl-2 text-right tabular-nums text-white/75'}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Kumulierte Punkte nach jedem Spiel. Eine Linie, Nulllinie als Bezug, Fadenkreuz beim Überfahren. */
function Timeline({ points }: { points: { at: string; points: number; total: number }[] }) {
  const W = 600;
  const H = 150;
  const PAD = { t: 10, b: 18, l: 0, r: 0 };
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const values = [0, ...points.map((p) => p.total)];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => PAD.l + (i / (values.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - min) / span) * (H - PAD.t - PAD.b);
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const area = `${line}L${x(values.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const last = values.length - 1;
  const h = hover ?? last;

  const onMove = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * last);
    setHover(Math.max(1, Math.min(last, i)));
  };

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-36 w-full touch-pan-y overflow-visible"
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`Punkteverlauf über ${points.length} Spiele, zuletzt ${signed(points[points.length - 1].total)}`}
      >
        <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.14)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <path d={area} fill="var(--color-gold-400)" opacity={0.1} />
        <path
          d={line}
          fill="none"
          stroke="var(--color-gold-400)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {hover !== null && (
          <line x1={x(h)} x2={x(h)} y1={PAD.t} y2={H - PAD.b} stroke="rgba(255,255,255,0.3)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      {/* Punkt und Beschriftung als HTML, damit sie trotz gestreckter Grafik rund bleiben */}
      <span
        className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-400 ring-2 ring-felt-900"
        style={{ left: `${(x(h) / W) * 100}%`, top: `${(y(values[h]) / H) * 100}%` }}
      />
      <div
        className={`pointer-events-none absolute -top-1 rounded-md bg-felt-950/90 px-2 py-1 text-xs whitespace-nowrap shadow ring-1 ring-white/10 ${
          x(h) / W > 0.7 ? '-translate-x-full' : ''
        }`}
        style={{ left: `${(x(h) / W) * 100}%` }}
      >
        <span className="font-semibold tabular-nums">{signed(values[h])}</span>
        <span className="text-white/50">
          {' '}
          · Spiel {h} · {signed(points[h - 1].points)} · {date(points[h - 1].at)}
        </span>
      </div>
      <div className="tag mt-1 flex justify-between text-[9px] text-white/35">
        <span>{date(points[0].at)}</span>
        <span>
          {points.length} Spiele · {date(points[points.length - 1].at)}
        </span>
      </div>
    </div>
  );
}
