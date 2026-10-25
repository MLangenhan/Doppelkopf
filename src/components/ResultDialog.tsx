import type { Party, PublicGameState } from '@engine';
import { motion } from 'motion/react';
import { partyLabel, resultKindLabel, SCHMEISSEN_LABEL } from '../lib/gameText';
import type { SchmeissenReason } from '@engine';
import { PartyBadge } from './Seat';

export function ResultDialog({
  view,
  name,
  myPos,
  onNext,
  onClose,
  busy,
  canStart,
}: {
  view: PublicGameState;
  name: (pos: number) => string;
  myPos: number;
  onNext: () => void;
  onClose: () => void;
  busy: boolean;
  canStart: boolean;
}) {
  const r = view.result;

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-title"
    >
      <motion.div
        className="panel max-h-full w-full max-w-lg overflow-y-auto p-6"
        initial={{ y: 30, scale: 0.95, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 24, delay: 0.1 }}
      >
        {view.redeal ? (
          <>
            <h2 id="result-title" className="font-display text-2xl font-bold text-gold-300">
              Neu geben
            </h2>
            <p className="mt-2 text-white/80">
              {view.redeal.reason === 'schmeissen'
                ? `${name(view.redeal.pos)} hat geschmissen (${SCHMEISSEN_LABEL[view.redeal.detail as SchmeissenReason] ?? view.redeal.detail}).`
                : `Niemand wollte die Armut von ${name(view.redeal.pos)} mitnehmen.`}
            </p>
          </>
        ) : r ? (
          <ResultBody view={view} name={name} myPos={myPos} />
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button className="btn-ghost" onClick={onClose}>
            Tisch ansehen
          </button>
          <button className="btn-primary min-w-40" onClick={onNext} disabled={busy || !canStart} autoFocus>
            {view.redeal ? 'Neu geben' : 'Nächstes Spiel'}
          </button>
        </div>
        {!canStart && <p className="mt-2 text-right text-xs text-white/50">Es werden 4 oder 5 Spieler am Tisch gebraucht.</p>}
      </motion.div>
    </motion.div>
  );
}

function ResultBody({ view, name, myPos }: { view: PublicGameState; name: (pos: number) => string; myPos: number }) {
  const r = view.result!;
  const winner = r.winner;
  const myParty: Party | null = myPos >= 0 ? (r.reTeam.includes(myPos) ? 're' : 'kontra') : null;
  const iWon = myParty !== null && winner === myParty;
  const rePct = (r.augen.re / 240) * 100;
  const kind = view.revealedKind ?? view.kind ?? 'normal';
  const soloist = r.soloScoring ? r.reTeam[0] : null;

  return (
    <>
      <p className="text-sm font-medium text-white/60">
        {resultKindLabel(kind, view.solo)}
        {soloist !== null && ` von ${name(soloist)}`}
        {view.revealedKind === 'silentSolo' && ' – Überraschung!'}
      </p>
      <h2 id="result-title" className="font-display text-3xl font-bold text-gold-300">
        {winner ? `${partyLabel(winner)} gewinnt` : 'Kein Gewinner'}
        {myParty && winner && <span className="ml-2 text-2xl">{iWon ? '🎉' : '😬'}</span>}
      </h2>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        {(['re', 'kontra'] as const).map((p) => (
          <div key={p} className={`rounded-xl p-3 ${winner === p ? 'bg-white/10 ring-1 ring-gold-400/60' : 'bg-white/5'}`}>
            <div className="flex items-center justify-between">
              <PartyBadge party={p} />
              <span className="font-mono text-lg font-bold">{r.augen[p]}</span>
            </div>
            <div className="mt-1.5 text-white/75">{(p === 're' ? r.reTeam : r.kontraTeam).map(name).join(' & ')}</div>
            <div className="text-xs text-white/50">
              {r.tricks[p]} {r.tricks[p] === 1 ? 'Stich' : 'Stiche'}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-kontra/70" aria-hidden>
        <motion.div
          className="h-full rounded-full bg-re"
          initial={{ width: '50%' }}
          animate={{ width: `${rePct}%` }}
          transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }}
        />
      </div>

      {r.lines.length > 0 && (
        <ul className="mt-5 space-y-1 text-sm">
          {r.lines.map((l, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.06 }}
              className="flex items-center justify-between rounded-lg px-2 py-1 odd:bg-white/5"
            >
              <span className="flex items-center gap-2">
                <PartyBadge party={l.party} small />
                {l.label}
              </span>
              <span className="font-mono font-semibold">+{l.points}</span>
            </motion.li>
          ))}
        </ul>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {r.scores.map((s, p) => (
          <motion.div
            key={p}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 + p * 0.07, type: 'spring' }}
            className={`rounded-xl px-3 py-2 text-center ${p === myPos ? 'ring-2 ring-gold-400' : ''} ${
              s > 0 ? 'bg-emerald-500/20' : s < 0 ? 'bg-red-500/20' : 'bg-white/10'
            }`}
          >
            <div className="truncate text-xs text-white/70">{name(p)}</div>
            <div className="font-mono text-xl font-bold">{s > 0 ? `+${s}` : s}</div>
          </motion.div>
        ))}
      </div>
    </>
  );
}
