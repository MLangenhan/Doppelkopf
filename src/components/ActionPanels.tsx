import {
  allowedDeclarations,
  type AnnounceLevel,
  type Card,
  type Declaration,
  type Party,
  type PublicGameState,
  SOLO_NAMES,
} from '@engine';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { levelLabel, SCHMEISSEN_LABEL } from '../lib/gameText';

function Bubble({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className={`panel px-4 py-3 ${className}`}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Vorbehalte
// ---------------------------------------------------------------------------

export function ReservationPanel({
  view,
  myPos,
  hand,
  name,
  onDeclare,
  busy,
}: {
  view: PublicGameState;
  myPos: number;
  hand: Card[];
  name: (pos: number) => string;
  onDeclare: (d: Declaration) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<Declaration | null>(null);
  const myTurn = view.declTurn === myPos;

  useEffect(() => {
    if (!myTurn) {
      setOpen(false);
      setConfirm(null);
    }
  }, [myTurn]);

  if (!myTurn) {
    return (
      <Bubble className="text-center text-sm text-white/80">
        {view.declTurn !== null ? (
          <>
            <span className="font-semibold text-white">{name(view.declTurn)}</span> überlegt …
          </>
        ) : (
          'Vorbehalte werden ausgewertet …'
        )}
      </Bubble>
    );
  }

  const options = allowedDeclarations(hand, view.settings);
  const special = options.filter((d) => d.kind !== 'healthy' && d.kind !== 'solo');
  const soli = options.filter((d): d is Extract<Declaration, { kind: 'solo' }> => d.kind === 'solo');
  const hasHochzeit = options.some((d) => d.kind === 'hochzeit');

  const choose = (d: Declaration) => {
    if (confirm && JSON.stringify(confirm) === JSON.stringify(d)) {
      onDeclare(d);
      setConfirm(null);
    } else {
      setConfirm(d);
    }
  };

  const optionLabel = (d: Declaration) =>
    d.kind === 'hochzeit'
      ? 'Hochzeit'
      : d.kind === 'armut'
        ? 'Armut'
        : d.kind === 'schmeissen'
          ? `Schmeißen – ${SCHMEISSEN_LABEL[d.reason]}`
          : d.kind === 'solo'
            ? SOLO_NAMES[d.solo]
            : 'Gesund';

  return (
    <Bubble className="w-full max-w-xl">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <span className="text-sm font-medium text-white/85">Du bist dran:</span>
        <button className="btn-primary min-w-28" disabled={busy} onClick={() => onDeclare({ kind: 'healthy' })} autoFocus>
          Gesund
        </button>
        <button className="btn-secondary min-w-28" disabled={busy} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          Vorbehalt …
        </button>
      </div>
      {hasHochzeit && !open && (
        <p className="mt-2 text-center text-xs text-white/60">
          Du hast beide Kreuz-Damen. „Gesund“ bedeutet stilles Solo.
        </p>
      )}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
              {special.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2">
                  {special.map((d) => (
                    <OptionButton key={JSON.stringify(d)} active={confirm} d={d} onClick={choose} label={optionLabel(d)} busy={busy} />
                  ))}
                </div>
              )}
              {soli.length > 0 && (
                <div>
                  <p className="mb-1.5 text-center text-xs font-semibold tracking-wider text-white/50 uppercase">Solo</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {soli.map((d) => (
                      <OptionButton key={d.solo} active={confirm} d={d} onClick={choose} label={SOLO_NAMES[d.solo]} busy={busy} />
                    ))}
                  </div>
                </div>
              )}
              <p className="text-center text-xs text-white/50">
                {confirm ? 'Zum Bestätigen nochmal klicken.' : 'Auswählen und zum Bestätigen nochmal klicken.'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Bubble>
  );
}

function OptionButton({
  d,
  active,
  onClick,
  label,
  busy,
}: {
  d: Declaration;
  active: Declaration | null;
  onClick: (d: Declaration) => void;
  label: string;
  busy: boolean;
}) {
  const isActive = active !== null && JSON.stringify(active) === JSON.stringify(d);
  return (
    <button
      className={`btn px-3 py-2 ${isActive ? 'bg-gold-400 text-felt-950' : 'border border-white/15 bg-white/5 hover:bg-white/15'}`}
      onClick={() => onClick(d)}
      disabled={busy}
    >
      {isActive ? `${label} – sicher?` : label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Armut
// ---------------------------------------------------------------------------

export function ArmutOfferPanel({
  view,
  myPos,
  name,
  onAnswer,
  busy,
}: {
  view: PublicGameState;
  myPos: number;
  name: (pos: number) => string;
  onAnswer: (accept: boolean) => void;
  busy: boolean;
}) {
  const a = view.armut!;
  if (a.offerTurn !== myPos) {
    return (
      <Bubble className="text-center text-sm text-white/80">
        <span className="font-semibold text-white">{name(a.poor)}</span> hat eine Armut.{' '}
        {a.offerTurn !== null && (
          <>
            <span className="font-semibold text-white">{name(a.offerTurn)}</span> überlegt, ob sie mitgenommen wird …
          </>
        )}
      </Bubble>
    );
  }
  return (
    <Bubble className="text-center">
      <p className="text-sm">
        <span className="font-semibold">{name(a.poor)}</span> hat eine Armut (3 Trümpfe). Nimmst du sie mit?
      </p>
      <p className="mt-1 text-xs text-white/60">Du bekommst die Trümpfe und gibst 3 beliebige Karten zurück. Ihr spielt dann zusammen.</p>
      <div className="mt-3 flex justify-center gap-3">
        <button className="btn-primary" disabled={busy} onClick={() => onAnswer(true)}>
          Mitnehmen
        </button>
        <button className="btn-secondary" disabled={busy} onClick={() => onAnswer(false)}>
          Nein danke
        </button>
      </div>
    </Bubble>
  );
}

export function ArmutReturnPanel({
  view,
  myPos,
  name,
  picked,
  onConfirm,
  busy,
}: {
  view: PublicGameState;
  myPos: number;
  name: (pos: number) => string;
  picked: number;
  onConfirm: () => void;
  busy: boolean;
}) {
  const a = view.armut!;
  if (a.rich !== myPos) {
    return (
      <Bubble className="text-center text-sm text-white/80">
        <span className="font-semibold text-white">{name(a.rich!)}</span> nimmt die Armut mit und sucht 3 Karten für{' '}
        <span className="font-semibold text-white">{name(a.poor)}</span> aus …
      </Bubble>
    );
  }
  return (
    <Bubble className="flex flex-wrap items-center justify-center gap-3 text-sm">
      <span>
        Wähle <strong>3 Karten</strong>, die du an {name(a.poor)} zurückgibst ({picked}/3)
      </span>
      <button className="btn-primary" disabled={busy || picked !== 3} onClick={onConfirm}>
        Zurückgeben
      </button>
    </Bubble>
  );
}

// ---------------------------------------------------------------------------
// Ansagen
// ---------------------------------------------------------------------------

export function AnnouncePanel({
  options,
  party,
  onAnnounce,
  busy,
  row,
}: {
  options: AnnounceLevel[];
  party: Party | null;
  onAnnounce: (l: AnnounceLevel) => void;
  busy: boolean;
  /** Nebeneinander statt untereinander (Handy) */
  row?: boolean;
}) {
  const [armed, setArmed] = useState<AnnounceLevel | null>(null);

  useEffect(() => {
    if (armed === null) return;
    const t = setTimeout(() => setArmed(null), 3500);
    return () => clearTimeout(t);
  }, [armed]);

  if (!party || options.length === 0) return null;
  return (
    <div className={`flex items-stretch gap-1.5 ${row ? 'flex-row items-center justify-center' : 'flex-col'}`} role="group" aria-label="Ansagen">
      <span className="text-center text-[11px] font-semibold tracking-wider text-white/50 uppercase">Ansage</span>
      {/* Nur die nächsten beiden Stufen anbieten – übersichtlicher, Sprünge sind trotzdem möglich */}
      {options.slice(0, 2).map((l) => {
        const isArmed = armed === l;
        return (
          <motion.button
            key={l}
            layout
            className={`btn px-3 py-1.5 ${
              isArmed
                ? 'bg-gold-400 text-felt-950'
                : l === 120
                  ? party === 're'
                    ? 'bg-re/85 text-felt-950 hover:bg-re'
                    : 'bg-kontra/85 text-felt-950 hover:bg-kontra'
                  : 'border border-white/15 bg-white/10 hover:bg-white/20'
            }`}
            disabled={busy}
            onClick={() => {
              if (isArmed) {
                setArmed(null);
                onAnnounce(l);
              } else setArmed(l);
            }}
          >
            {isArmed ? `${levelLabel(l, party)}?` : levelLabel(l, party)}
          </motion.button>
        );
      })}
    </div>
  );
}
