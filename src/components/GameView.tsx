import {
  type AnnounceLevel,
  type Card,
  COLLECT_TIMEOUT_MS,
  type Declaration,
  faceOf,
  type GameAction,
  legalCards,
  SOLO_NAMES,
  sortHand,
  sumAugen,
} from '@engine';
import { ListOrdered, Video, VideoOff, X } from 'lucide-react';
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
import { sound } from '../lib/sound';
import type { GameRow, Member, ResultRow } from '../lib/supabase';
import type { RemoteVideo } from '../lib/video';
import { AnnouncePanel, ArmutOfferPanel, ArmutReturnPanel, ReservationPanel } from './ActionPanels';
import { Atmosphere } from './Atmosphere';
import { CameraButton, type CameraControls } from './CameraButton';
import { Hand } from './Hand';
import { LastTrick } from './LastTrick';
import { MomentOverlay, useMoments } from './Moments';
import { ResultDialog } from './ResultDialog';
import { rulesSummary } from './RulesForm';
import { ScoreSheet } from './ScoreSheet';
import { Seat } from './Seat';
import { useToast } from './Toast';
import { type Rel, TrickArea, type TrickPlay } from './TrickArea';
import { VideoTile } from './VideoTile';

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

  const myTurnToPlay = view.phase === 'playing' && view.turn === myPos && !pending && !view.collectPending;
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
        sound.nope();
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

  // ---- Stich-Anzeige: ein fertiger Stich liegt, bis der Gewinner ihn nimmt ----
  const trickCount = view.trickWinners.length;
  const pendingTrick = view.collectPending && view.current?.winner != null ? view.current : null;
  const currentPlays: TrickPlay[] = (view.current?.cards ?? []).map((card, i) => ({
    card,
    rel: rel((view.current!.leader + i) % 4),
  }));
  if (pending && !currentPlays.some((p) => p.card === pending)) currentPlays.push({ card: pending, rel: 0 });
  const shownTrick: { key: string; plays: TrickPlay[]; winner: number | null } = pendingTrick
    ? { key: `${game.id}:${trickCount - 1}`, plays: currentPlays, winner: pendingTrick.winner }
    : { key: `${game.id}:${trickCount}`, plays: currentPlays, winner: null };

  // Stich nehmen: der Gewinner per Leertaste oder Klick; nach der Wartezeit dürfen alle wegräumen
  const iCollect = !!pendingTrick && pendingTrick.winner === myPos;
  const [collectSeen, setCollectSeen] = useState<{ key: string; at: number } | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (!pendingTrick) return;
    setCollectSeen((cur) => (cur?.key === shownTrick.key ? cur : { key: shownTrick.key, at: Date.now() }));
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, [pendingTrick, shownTrick.key]);
  const canForceCollect =
    !!pendingTrick &&
    !iCollect &&
    myPos >= 0 &&
    collectSeen?.key === shownTrick.key &&
    clock - collectSeen.at >= COLLECT_TIMEOUT_MS;
  const collect = () => {
    if (busy) return;
    run(() => act({ type: 'collect' }));
  };
  const collectRef = useRef(collect);
  collectRef.current = collect;
  useEffect(() => {
    if (!iCollect) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.code !== 'Space' || e.repeat || el?.closest('input, textarea, select, [contenteditable]')) return;
      e.preventDefault();
      collectRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [iCollect]);

  // ---- Ergebnis (kurz nach dem letzten Stich, damit man das Einsammeln noch sieht) ----
  const finished = view.phase === 'finished';
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [readyFor, setReadyFor] = useState<string | null>(null);
  useEffect(() => {
    if (!finished) return;
    const t = setTimeout(() => setReadyFor(game.id), view.redeal ? 0 : 700);
    return () => clearTimeout(t);
  }, [finished, game.id, view.redeal]);
  const resultReady = finished && readyFor === game.id;
  const showResult = resultReady && dismissed !== game.id;

  // ---- Sonstiges ----
  const party = getMyParty(view, myPos, hand);
  const announce = announceOptions(view, myPos, party);
  const sittingOut = members.filter((m) => !game.players.includes(m.user_id));

  // ---- Sounds: aus Zustandsänderungen ableiten, damit sie für alle gleich klingen ----
  const played = trickCount * 4 + (view.collectPending ? 0 : currentPlays.length);
  const myTurnNow =
    (view.phase === 'playing' && view.turn === myPos) ||
    (view.phase === 'reservations' && view.declTurn === myPos) ||
    (view.phase === 'armutOffer' && view.armut?.offerTurn === myPos) ||
    (view.phase === 'armutReturn' && view.armut?.rich === myPos);
  const soundState = useRef<{
    game: string;
    played: number;
    ann: number;
    turn: boolean;
    trickKey: string;
    trickDone: boolean;
    result: boolean;
  } | null>(null);
  useEffect(() => {
    const prev = soundState.current;
    const now = {
      game: game.id,
      played,
      ann: view.announcementLog.length,
      turn: myTurnNow && !pending,
      trickKey: shownTrick.key,
      trickDone: shownTrick.winner !== null,
      result: showResult,
    };
    soundState.current = now;
    // Beim Öffnen der Seite nicht losklappern
    if (!prev) return;
    if (prev.game !== now.game) {
      if (myPos >= 0) sound.deal(view.settings.withNines ? 12 : 10);
      return;
    }
    for (let i = 0; i < Math.min(3, now.played - prev.played); i++) sound.card(i * 0.12);
    if (prev.trickDone && prev.trickKey !== now.trickKey) sound.collect();
    if (now.ann > prev.ann) sound.announce();
    if (now.turn && !prev.turn) sound.turn();
    if (now.result && !prev.result && view.result?.winner && myPos >= 0) {
      const mine = view.result.reTeam.includes(myPos) ? 're' : 'kontra';
      if (view.result.winner === mine) sound.win();
      else sound.lose();
    }
  });
  // ---- Große Momente ----
  const moments = useMoments();
  const momentState = useRef<{
    game: string;
    ann: number;
    kind: string | null;
    partner: number | null;
    alone: boolean;
    schwein: number | null;
    tricks: number;
  } | null>(null);
  useEffect(() => {
    const prev = momentState.current;
    const now = {
      game: game.id,
      ann: view.announcementLog.length,
      kind: view.kind,
      partner: view.hochzeit?.partner ?? null,
      alone: !!view.hochzeit?.alone,
      schwein: view.schweinchen,
      tricks: trickCount,
    };
    momentState.current = now;
    if (!prev || prev.game !== now.game) return;
    let special = false;

    for (const a of view.announcementLog.slice(prev.ann)) {
      moments.push({ title: `${levelLabel(a.level, a.party)}!`, sub: name(a.pos), tone: a.party });
    }
    if (!prev.kind && now.kind && now.kind !== 'normal') {
      special = true;
      if (now.kind === 'solo') moments.push({ title: SOLO_NAMES[view.solo!], sub: `${name(view.soloist!)} spielt allein` });
      if (now.kind === 'hochzeit') moments.push({ title: 'Hochzeit!', sub: `${name(view.hochzeit!.bride)} sucht einen Partner` });
      if (now.kind === 'armut') moments.push({ title: 'Armut', sub: `${name(view.armut!.poor)} & ${name(view.armut!.rich!)}` });
    }
    if (prev.partner === null && now.partner !== null) {
      special = true;
      moments.push({ title: 'Verlobt!', sub: `${name(view.hochzeit!.bride)} & ${name(now.partner)}` });
    }
    if (!prev.alone && now.alone) {
      special = true;
      moments.push({ title: 'Allein!', sub: `${name(view.hochzeit!.bride)} hat keinen Partner gefunden` });
    }
    if (prev.schwein === null && now.schwein !== null) {
      special = true;
      moments.push({ title: 'Schweinchen!', sub: name(now.schwein) });
    }
    if (now.tricks > prev.tricks && view.lastTrick) {
      const t = view.lastTrick;
      const w = t.winner!;
      const augen = sumAugen(t.cards);
      const partyOf = (p: number) => (p === myPos ? party : view.knownParties[p]);
      if (view.settings.doppelkopf && view.kind !== 'solo' && augen >= 40) {
        special = true;
        moments.push({ title: 'Doppelkopf!', sub: `${augen} Augen für ${name(w)}` });
      }
      if (view.settings.fuchs && view.kind !== 'solo' && view.schweinchen === null) {
        t.cards.forEach((c, i) => {
          const by = (t.leader + i) % 4;
          if (faceOf(c) === 'D-A' && by !== w && partyOf(by) && partyOf(w) && partyOf(by) !== partyOf(w)) {
            special = true;
            moments.push({ title: 'Fuchs gefangen!', sub: `${name(w)} fängt den Fuchs von ${name(by)}` });
          }
        });
      }
      const lastOne = view.handCounts.every((n) => n === 0);
      if (view.settings.karlchen && view.kind !== 'solo' && lastOne && faceOf(t.cards[(w - t.leader + 4) % 4]) === 'C-J') {
        special = true;
        moments.push({ title: 'Karlchen!', sub: `${name(w)} macht den letzten Stich` });
      }
    }
    if (special) sound.announce();
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Seitenleiste nur auf sehr breiten Bildschirmen dauerhaft, sonst als Schublade – der Tisch braucht den Platz
  const wide = vp.w >= 1700;

  const trickCardW = Math.round(Math.max(60, Math.min(96, Math.min(vp.w * 0.065, vp.h * 0.085))));
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
    } else if (pendingTrick) {
      panel = iCollect ? (
        <motion.div
          key="collect"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-full bg-gold-400 py-1.5 pr-1.5 pl-4 text-sm font-semibold text-felt-950 shadow-lg"
        >
          Dein Stich! Schau ihn dir an und nimm ihn dann
          <button className="rounded-full bg-felt-950 px-3 py-1 text-gold-300 hover:bg-felt-800" onClick={collect} disabled={busy}>
            <kbd className="mr-1.5 rounded border border-gold-400/40 px-1.5 text-[11px]">Leertaste</kbd>
            Nehmen
          </button>
        </motion.div>
      ) : (
        <motion.div
          key="others-collect"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel flex items-center gap-3 px-4 py-2 text-sm text-white/80"
        >
          <span>
            <span className="font-semibold text-white">{name(pendingTrick.winner!)}</span> nimmt den Stich …
          </span>
          {canForceCollect && (
            <button className="btn-secondary px-3 py-1" onClick={collect} disabled={busy}>
              Stich wegräumen
            </button>
          )}
        </motion.div>
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
          {/* Eine schlanke Infozeile statt vieler Kästen */}
          <div className="tag flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[11px] text-white/50">
            <span className="text-white/80">Spiel {String(game.number).padStart(2, '0')}</span>
            <span aria-hidden>/</span>
            <span className="text-white/80">{gameKindLabel(view, name)}</span>
            {announcementText && (
              <>
                <span aria-hidden>/</span>
                <span className="text-gold-300">{announcementText}</span>
              </>
            )}
            {view.armut?.returnedTrumps != null && view.kind === 'armut' && (
              <>
                <span aria-hidden>/</span>
                <span>
                  {view.armut.returnedTrumps} {view.armut.returnedTrumps === 1 ? 'Trumpf' : 'Trümpfe'} zurück
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!wide && (
              <button
                className="btn-ghost p-2"
                onClick={() => setSidebarOpen(true)}
                aria-label="Punkte und Regeln"
                data-cursor="Punkte"
              >
                <ListOrdered className="size-4" />
              </button>
            )}
            {camera.state === 'on' ? (
              <button
                className={`btn-ghost p-2 ${camera.enabled ? '' : 'text-red-300'}`}
                onClick={camera.toggle}
                aria-pressed={camera.enabled}
                aria-label={camera.enabled ? 'Kamera ausschalten' : 'Kamera einschalten'}
                data-cursor={camera.enabled ? 'Kamera aus' : 'Kamera an'}
              >
                {camera.enabled ? <Video className="size-4" /> : <VideoOff className="size-4" />}
              </button>
            ) : camera.state === 'off' ? (
              <button className="btn-ghost p-2 text-white/55" onClick={camera.start} aria-label="Kamera einschalten" data-cursor="Kamera an">
                <VideoOff className="size-4" />
              </button>
            ) : (
              <CameraButton camera={camera} compact />
            )}
          </div>
          {view.phase === 'playing' && <LastTrick trick={view.collectPending ? view.previousTrick : view.lastTrick} name={name} />}
          {sittingOut.map((m) => (
            <VideoTile
              key={m.user_id}
              stream={streamOf(m.user_id)}
              name={m.display_name}
              mirror={m.user_id === me}
              videoOff={m.user_id === me && !camera.enabled}
              className="aspect-[4/3] w-40"
            >
              <div className="tag absolute bottom-1.5 left-1.5 rounded bg-felt-950/75 px-1.5 py-0.5 text-[10px]">
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
            winnerLabel={
              shownTrick.winner === null
                ? undefined
                : shownTrick.winner === myPos
                  ? 'Dein Stich'
                  : `Stich für ${name(shownTrick.winner)}`
            }
            cardWidth={trickCardW}
            onCollect={iCollect ? collect : undefined}
          >
            <MomentOverlay moment={moments.current} />
          </TrickArea>
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
