import {
  type AnnounceLevel,
  type Card,
  type Declaration,
  type GameAction,
  legalCards,
  sortHand,
  type Trick,
} from '@engine';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  announceOptions,
  gameKindLabel,
  hasSchweinchen,
  levelLabel,
  myParty as getMyParty,
  partyLabel,
  trumpMode,
} from '../lib/gameText';
import { usePrefs } from '../lib/prefs';
import type { GameRow, Member, ResultRow } from '../lib/supabase';
import type { RemoteVideo } from '../lib/video';
import { AnnouncePanel, ArmutOfferPanel, ArmutReturnPanel, ReservationPanel } from './ActionPanels';
import { Atmosphere } from './Atmosphere';
import { CameraButton, type CameraControls } from './CameraButton';
import { Hand } from './Hand';
import { PlayingCard } from './PlayingCard';
import { ResultDialog } from './ResultDialog';
import { rulesSummary } from './RulesForm';
import { ScoreSheet } from './ScoreSheet';
import { Seat } from './Seat';
import { useToast } from './Toast';
import { type Rel, TrickArea, type TrickPlay } from './TrickArea';
import { VideoTile } from './VideoTile';

const HOLD_TRICK_MS = 1600;

function useViewport() {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return size;
}

export function GameView({
  game,
  hand,
  members,
  results,
  me,
  camera,
  remotes,
  online,
  act,
  startGame,
  onShowLobby,
}: {
  game: GameRow;
  hand: Card[];
  members: Member[];
  results: ResultRow[];
  me: string | null;
  camera: CameraControls;
  remotes: Record<string, RemoteVideo>;
  online: string[];
  act: (a: GameAction) => Promise<void>;
  startGame: () => Promise<void>;
  onShowLobby?: () => void;
}) {
  const toast = useToast();
  const vp = useViewport();
  const view = game.state;
  const myPos = me ? game.players.indexOf(me) : -1;
  const viewPos = myPos >= 0 ? myPos : 0;
  const rel = (pos: number) => ((pos - viewPos + 4) % 4) as Rel;
  const posAt = (r: Rel) => (viewPos + r) % 4;
  const nameOfUser = (uid: string) => members.find((m) => m.user_id === uid)?.display_name ?? 'Ehemalig';
  const name = (pos: number) => nameOfUser(game.players[pos]);
  const streamOf = (uid: string) => (uid === me ? camera.stream : remotes[uid]?.stream);

  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  // ---- Karte spielen (optimistisch: sofort in die Mitte legen) ----
  const [pending, setPending] = useState<Card | null>(null);
  useEffect(() => {
    if (pending && !hand.includes(pending)) setPending(null);
  }, [hand, pending]);

  const ctx = { mode: trumpMode(view), schweinchen: hasSchweinchen(view, hand) };
  const shownHand = useMemo(
    () => sortHand(hand.filter((c) => c !== pending), ctx),
    [hand, pending, ctx.mode, ctx.schweinchen],
  );

  const myTurnToPlay = view.phase === 'playing' && view.turn === myPos && !pending;
  // Ohne Hervorhebung ("schwarz spielen") ist jede Karte wählbar; der Server prüft das Bedienen
  const [prefs] = usePrefs();
  const playable =
    myTurnToPlay && view.current
      ? new Set(prefs.highlightPlayable ? legalCards(hand, view.current.cards, ctx) : hand)
      : null;

  const play = (card: Card) => {
    setPending(card);
    run(async () => {
      try {
        await act({ type: 'play', card });
      } catch (e) {
        setPending(null);
        throw e;
      }
    });
  };

  // ---- Armut: Karten zurückgeben ----
  const [picked, setPicked] = useState<Set<Card>>(new Set());
  const handBeforeArmut = useRef<Card[]>([]);
  if (view.phase !== 'armutReturn') handBeforeArmut.current = hand;
  const isRichReturning = view.phase === 'armutReturn' && view.armut?.rich === myPos;
  const newCards = useMemo(
    () => (isRichReturning ? new Set(hand.filter((c) => !handBeforeArmut.current.includes(c))) : undefined),
    [isRichReturning, hand],
  );
  useEffect(() => setPicked(new Set()), [view.phase]);

  // ---- Stich-Anzeige: fertigen Stich kurz stehen lassen ----
  const trickCount = view.trickWinners.length;
  const [expiredFor, setExpiredFor] = useState(-1);
  useEffect(() => {
    if (trickCount === 0) return;
    const t = setTimeout(() => setExpiredFor(trickCount), HOLD_TRICK_MS);
    return () => clearTimeout(t);
  }, [trickCount, game.id]);

  const currentPlays: TrickPlay[] = (view.current?.cards ?? []).map((card, i) => ({
    card,
    rel: rel((view.current!.leader + i) % 4),
  }));
  if (pending && !currentPlays.some((p) => p.card === pending)) currentPlays.push({ card: pending, rel: 0 });

  const showCompleted = currentPlays.length === 0 && !!view.lastTrick && expiredFor !== trickCount;
  const shownTrick: { key: string; plays: TrickPlay[]; winner: number | null } = showCompleted
    ? {
        key: `${game.id}:${trickCount - 1}`,
        plays: view.lastTrick!.cards.map((card, i) => ({ card, rel: rel((view.lastTrick!.leader + i) % 4) })),
        winner: view.lastTrick!.winner,
      }
    : { key: `${game.id}:${trickCount}`, plays: currentPlays, winner: null };

  // ---- Ergebnis ----
  const finished = view.phase === 'finished';
  const [dismissed, setDismissed] = useState<string | null>(null);
  const resultReady = finished && (view.redeal !== null || expiredFor === trickCount);
  const showResult = resultReady && dismissed !== game.id;

  // ---- Sonstiges ----
  const party = getMyParty(view, myPos, hand);
  const announce = announceOptions(view, myPos, party);
  const sittingOut = members.filter((m) => !game.players.includes(m.user_id));
  const [showLastTrick, setShowLastTrick] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Seitenleiste nur auf sehr breiten Bildschirmen dauerhaft, sonst als Schublade – der Tisch braucht den Platz
  const wide = vp.w >= 1700;

  const trickCardW = Math.round(Math.max(64, Math.min(104, Math.min(vp.w * 0.07, vp.h * 0.1))));
  // Kameras in den vier Ecken, so groß wie es der Platz erlaubt
  const camW = Math.round(Math.max(180, Math.min(400, vp.w * 0.22, vp.h * 0.36)));

  const calloutsFor = (pos: number) =>
    view.announcementLog.filter((a) => a.pos === pos).map((a) => levelLabel(a.level, a.party));

  const seatStatus = (pos: number) => {
    if (view.phase === 'reservations') {
      const d = view.declarations[pos];
      if (d === 'healthy') return <span className="text-emerald-300">Gesund</span>;
      if (d === 'reserved') return <span className="font-semibold text-gold-300">Vorbehalt!</span>;
      if (view.declTurn === pos) return <span className="text-white/70">überlegt …</span>;
      return null;
    }
    if (view.kind === 'solo' && view.soloist === pos) return <span className="font-semibold text-gold-300">Solist</span>;
    if (view.schweinchen === pos) return <span className="font-semibold text-gold-300">Schweinchen</span>;
    return null;
  };

  const seatFor = (r: Rel) => {
    const pos = posAt(r);
    const uid = game.players[pos];
    const isMe = uid === me;
    return (
      <Seat
        name={name(pos)}
        stream={streamOf(uid)}
        isMe={isMe}
        videoOff={isMe && !camera.enabled}
        isTurn={(view.phase === 'playing' && view.turn === pos) || (view.phase === 'reservations' && view.declTurn === pos)}
        party={isMe ? party : view.knownParties[pos]}
        isDealer={game.seats[pos] === game.dealer_seat}
        tricks={view.trickWinners.filter((w) => w === pos).length}
        cardsLeft={view.phase === 'finished' ? undefined : view.handCounts[pos]}
        status={seatStatus(pos)}
        callouts={calloutsFor(pos)}
        online={isMe || online.includes(uid)}
        connecting={!isMe && online.includes(uid) && remotes[uid]?.status === 'connecting'}
      />
    );
  };

  // ---- Panel über der Hand ----
  let panel: React.ReactNode = null;
  if (myPos >= 0) {
    if (view.phase === 'reservations') {
      panel = (
        <ReservationPanel
          view={view}
          myPos={myPos}
          hand={hand}
          name={name}
          busy={busy}
          onDeclare={(d: Declaration) => run(() => act({ type: 'declare', declaration: d }))}
        />
      );
    } else if (view.phase === 'armutOffer') {
      panel = (
        <ArmutOfferPanel
          view={view}
          myPos={myPos}
          name={name}
          busy={busy}
          onAnswer={(accept) => run(() => act({ type: 'armutAnswer', accept }))}
        />
      );
    } else if (view.phase === 'armutReturn') {
      panel = (
        <ArmutReturnPanel
          view={view}
          myPos={myPos}
          name={name}
          busy={busy}
          picked={picked.size}
          onConfirm={() => run(() => act({ type: 'armutReturn', cards: [...picked] }))}
        />
      );
    } else if (view.phase === 'playing' && view.turn === myPos && !pending) {
      panel = (
        <motion.div
          key="turn"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-full bg-gold-400 px-4 py-1.5 text-sm font-semibold text-felt-950 shadow-lg"
        >
          Du bist dran – Karte zweimal antippen oder doppelklicken
        </motion.div>
      );
    }
  }

  const announcementText = (['re', 'kontra'] as const)
    .filter((p) => view.announcements[p] !== null)
    .map((p) => `${partyLabel(p)}${view.announcements[p] !== 120 ? `: ${levelLabel(view.announcements[p]!, p)}` : ''}`)
    .join(' · ');

  const sidebar = (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4">
      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wider text-white/50 uppercase">Punkte heute</h3>
        <ScoreSheet results={results} members={members} me={me} />
      </section>
      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wider text-white/50 uppercase">Hausregeln</h3>
        <ul className="flex flex-wrap gap-1.5">
          {rulesSummary(view.settings).map((s) => (
            <li key={s} className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/75">
              {s}
            </li>
          ))}
        </ul>
      </section>
      <div className="mt-auto flex flex-col gap-2">
        {onShowLobby && (
          <button className="btn-ghost" onClick={onShowLobby} disabled={!finished}>
            {finished ? 'Plätze & Regeln' : 'Plätze & Regeln (nach dem Spiel)'}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1">
      <main
        className="felt relative isolate grid min-w-0 flex-1 gap-3 p-3"
        style={{ gridTemplateColumns: `${camW}px minmax(0, 1fr) ${camW}px`, gridTemplateRows: 'auto minmax(0, 1fr) auto' }}
      >
        <Atmosphere />

        {/* Oben links: Spieler links von mir */}
        <div className="self-start">{seatFor(1)}</div>

        {/* Oben Mitte: Infoleiste und wer aussetzt */}
        <div className="flex min-w-0 flex-col items-center gap-3 self-start">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-sm">
            <span className="rounded-md bg-black/30 px-2 py-0.5 font-semibold">Spiel {game.number}</span>
            <span className="font-medium text-white/90">{gameKindLabel(view, name)}</span>
            {announcementText && (
              <span className="rounded-md bg-gold-400/90 px-2 py-0.5 font-semibold text-felt-950">{announcementText}</span>
            )}
            {view.armut?.returnedTrumps != null && view.kind === 'armut' && (
              <span className="text-white/60">
                {view.armut.returnedTrumps} {view.armut.returnedTrumps === 1 ? 'Trumpf' : 'Trümpfe'} zurück
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1">
            {view.lastTrick && view.phase === 'playing' && (
              <button className="btn-ghost px-2.5 py-1" onClick={() => setShowLastTrick((v) => !v)} aria-expanded={showLastTrick}>
                Letzter Stich
              </button>
            )}
            {!wide && (
              <button className="btn-ghost px-2.5 py-1" onClick={() => setSidebarOpen(true)}>
                Punkte & Regeln
              </button>
            )}
            <CameraButton camera={camera} compact />
          </div>
          {sittingOut.map((m) => (
            <VideoTile
              key={m.user_id}
              stream={streamOf(m.user_id)}
              name={m.display_name}
              mirror={m.user_id === me}
              videoOff={m.user_id === me && !camera.enabled}
              className="aspect-[4/3] w-40"
            >
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 pt-5 pb-1.5 text-xs font-semibold">
                {m.display_name}
                {m.user_id === me && ' (du)'} · setzt aus
              </div>
            </VideoTile>
          ))}
        </div>

        {/* Oben rechts: gegenüber */}
        <div className="self-start">{seatFor(2)}</div>

        {/* Mitte: der Stich */}
        <div className="col-span-3 grid min-h-0 place-items-center">
          <TrickArea
            trickKey={shownTrick.key}
            plays={shownTrick.plays}
            winnerRel={shownTrick.winner === null ? null : rel(shownTrick.winner)}
            winnerName={shownTrick.winner === null ? undefined : name(shownTrick.winner)}
            cardWidth={trickCardW}
          />
        </div>

        {/* Unten links: ich */}
        <div className="self-end">
          {myPos >= 0 ? (
            seatFor(0)
          ) : (
            <div className="panel grid aspect-[4/3] place-items-center p-4 text-center text-sm text-white/70">
              Du setzt diese Runde aus und schaust zu.
            </div>
          )}
        </div>

        {/* Unten Mitte: Hand, Aktionen, Ansagen */}
        <div className="flex min-w-0 items-end gap-3 self-end">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex min-h-11 items-end justify-center">
              <AnimatePresence mode="wait">{panel}</AnimatePresence>
            </div>
            {myPos >= 0 && (
              <Hand
                cards={shownHand}
                dealKey={game.id}
                mode={view.phase === 'armutReturn' && isRichReturning ? 'pick' : view.phase === 'playing' ? 'play' : 'view'}
                playable={playable}
                picked={picked}
                highlight={newCards}
                onPick={(c) =>
                  setPicked((cur) => {
                    const next = new Set(cur);
                    if (next.has(c)) next.delete(c);
                    else if (next.size < 3) next.add(c);
                    return next;
                  })
                }
                onPlay={play}
              />
            )}
          </div>
          {announce.length > 0 && (
            <div className="w-28 shrink-0 self-center">
              <AnnouncePanel
                options={announce}
                party={party}
                busy={busy}
                onAnnounce={(level: AnnounceLevel) => run(() => act({ type: 'announce', level }))}
              />
            </div>
          )}
        </div>

        {/* Unten rechts: Spieler rechts von mir */}
        <div className="self-end">{seatFor(3)}</div>

        <AnimatePresence>
          {showLastTrick && view.lastTrick && (
            <LastTrickPopover trick={view.lastTrick} name={name} onClose={() => setShowLastTrick(false)} />
          )}
        </AnimatePresence>
      </main>

      {wide ? (
        <aside className="w-72 shrink-0 border-l border-white/10 bg-felt-950">{sidebar}</aside>
      ) : (
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                className="fixed inset-0 z-40 bg-black/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
              />
              <motion.aside
                className="fixed inset-y-0 right-0 z-50 w-80 max-w-[90vw] border-l border-white/10 bg-felt-950/95"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              >
                <button className="btn-ghost absolute top-2 right-2 px-2 py-1" onClick={() => setSidebarOpen(false)} aria-label="Schließen">
                  <X className="h-5 w-5" />
                </button>
                {sidebar}
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      )}

      <AnimatePresence>
        {showResult && (
          <ResultDialog
            view={view}
            name={name}
            myPos={myPos}
            busy={busy}
            canStart={members.length >= 4 && members.length <= 5}
            onClose={() => setDismissed(game.id)}
            onNext={() => run(startGame)}
          />
        )}
      </AnimatePresence>

      {finished && resultReady && !showResult && (
        <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2">
          <button className="btn-primary shadow-panel" onClick={() => run(startGame)} disabled={busy}>
            {view.redeal ? 'Neu geben' : 'Nächstes Spiel'}
          </button>
        </div>
      )}
    </div>
  );
}

function LastTrickPopover({ trick, name, onClose }: { trick: Trick; name: (pos: number) => string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="panel absolute top-24 left-1/2 z-30 -translate-x-1/2 p-3"
      role="dialog"
      aria-label="Letzter Stich"
    >
      <div className="mb-2 flex items-center justify-between gap-4 text-sm">
        <span className="font-semibold">Letzter Stich – {name(trick.winner!)}</span>
        <button className="text-white/60 hover:text-white" onClick={onClose} aria-label="Schließen">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-2">
        {trick.cards.map((c, i) => {
          const pos = (trick.leader + i) % 4;
          return (
            <div key={c} className="flex flex-col items-center gap-1">
              <PlayingCard card={c} width={64} className={pos === trick.winner ? 'ring-2 ring-gold-400' : ''} />
              <span className="max-w-16 truncate text-xs text-white/70">{name(pos)}</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
