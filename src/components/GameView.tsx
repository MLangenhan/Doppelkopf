import {
  type AnnounceLevel,
  type Card,
  COLLECT_TIMEOUT_MS,
  type Declaration,
  faceOf,
  type GameAction,
  BOT_IDS,
  BOT_NAMES,
  isBot,
  type RuleSettings,
  isTrump,
  legalCards,
  SOLO_NAMES,
  sumAugen,
} from '@engine';
import { Crown, ArrowDownUp, ListOrdered, LogOut, Video, VideoOff, X } from 'lucide-react';
import { AnimatePresence, motion, useAnimate } from 'motion/react';
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
import type { AchievementEvent } from '../lib/achievementFeed';
import { eveningTitles } from '../lib/achievements';
import { moodOf } from '../lib/botMood';
import { useCardOrder } from '../lib/cardOrder';
import { giphyEnabled } from '../lib/giphy';
import { REACTION_KINDS, type ReactionKind, type ShownReaction } from '../lib/reactions';
import { arrangeHand, defaultFaceOrder, orderFromHand, updateFaceOrder } from '../lib/handSort';
import { HAND_SORT_LABELS, type HandSort, useFx, usePrefs } from '../lib/prefs';
import { sound } from '../lib/sound';
import type { GameRow, Member, ResultRow } from '../lib/supabase';
import type { RemoteVideo } from '../lib/video';
import { AnnouncePanel, ArmutOfferPanel, ArmutReturnPanel, ReservationPanel } from './ActionPanels';
import { Atmosphere } from './Atmosphere';
import { CameraButton, type CameraControls } from './CameraButton';
import { Hand } from './Hand';
import { CARD_RATIO, preloadCards } from './PlayingCard';
import { LastTrick } from './LastTrick';
import { MomentOverlay, useMoments } from './Moments';
import { ResultDialog } from './ResultDialog';
import { RulesForm, rulesSummary } from './RulesForm';
import { RecentGames } from './RecentGames';
import { SpaceHint } from './SpaceHint';
import { ScoreSheet } from './ScoreSheet';
import { Seat } from './Seat';
import { useToast } from './Toast';
import { type Rel, TrickArea, type TrickPlay } from './TrickArea';
import { VideoTile } from './VideoTile';
import { BotCat } from './BotCat';
import { CardGuide } from './CardGuide';
import { AchievementBanner } from './AchievementBanner';
import { ReactionPicker } from './Reactions';
import { LeaveDialog } from './LeaveDialog';

/** Größe eines Elements (für Layout, das sich nach dem freien Platz richtet) */
function useElementSize(el: HTMLElement | null) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return size;
}

/** Bots an echten Tischen (feste IDs) und im Übungsmodus ("bot-1" …) */
const isBotSeat = (uid: string) => isBot(uid) || uid.startsWith('bot-');
/** Welcher Bot (0 Anton, 1 Berta, 2 Carl) – fürs feste Standard-GIF */
const botIndex = (uid: string, fallback: number) =>
  uid.startsWith('bot-') ? Number(uid.slice(4)) - 1 : BOT_IDS.includes(uid) ? BOT_IDS.indexOf(uid) : fallback;

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
  finishedGames = [],
  me,
  camera,
  remotes,
  online,
  act,
  startGame,
  onShowLobby,
  onLeave,
  onAbort,
  rules,
  reactions,
  achievementFeed,
}: {
  game: GameRow;
  hand: Card[];
  members: Member[];
  results: ResultRow[];
  /** Fertige Spiele des Abends, neuestes zuerst */
  finishedGames?: GameRow[];
  me: string | null;
  camera: CameraControls;
  remotes: Record<string, RemoteVideo>;
  online: string[];
  act: (a: GameAction) => Promise<void>;
  startGame: () => Promise<void>;
  onShowLobby?: () => void;
  /** Zurück zur Übersicht (man bleibt am Tisch sitzen) */
  onLeave?: () => void;
  /** Laufendes Spiel für alle abbrechen */
  onAbort?: () => Promise<void> | void;
  /** Neu freigeschaltete Erfolge am Tisch */
  achievementFeed?: { current: AchievementEvent | null; done: (id: number) => void };
  /** Reaktionen am Tisch (Applaus, Autsch …) */
  reactions?: { shown: Record<string, ShownReaction>; send: (k: ReactionKind) => void };
  /** Hausregeln in der Seitenleiste anpassen */
  rules?: {
    value: RuleSettings;
    /** null = darf bearbeiten, sonst der Grund, warum nicht */
    locked: string | null;
    onSave: (s: RuleSettings) => Promise<void>;
    /** Bot-Stärke mit anbieten (an echten Tischen) */
    bots?: boolean;
  };
}) {
  const toast = useToast();
  const vp = useViewport();
  useEffect(preloadCards, []);
  const view = game.state;
  const myPos = me ? game.players.indexOf(me) : -1;
  // Wer aussetzt (zu fünft), sieht den Tisch von seinem Platz aus: unten links sitzt, wer nach ihm im Uhrzeigersinn kommt.
  // So rotiert die Ansicht mit dem Geber mit, und alle vier Spieler sind mit Kamera zu sehen.
  const mySeat = me ? members.find((m) => m.user_id === me)?.seat : undefined;
  const nextAfterMe =
    mySeat === undefined
      ? 0
      : game.seats
          .map((seat, pos) => ({ pos, d: (seat - mySeat + 5) % 5 || 5 }))
          .sort((a, b) => a.d - b.d)[0]?.pos ?? 0;
  const viewPos = myPos >= 0 ? myPos : nextAfterMe;
  const rel = (pos: number) => ((pos - viewPos + 4) % 4) as Rel;
  const posAt = (r: Rel) => (viewPos + r) % 4;
  const nameOfUser = (uid: string) =>
    members.find((m) => m.user_id === uid)?.display_name ?? (isBot(uid) ? `${BOT_NAMES[uid]} (Bot)` : 'Ehemalig');
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
  const [prefs, setPref] = usePrefs();
  // Eigene Reihenfolge: eine Rangfolge der Kartenarten für alle Spiele, im Profil gespeichert
  const [faceOrder, saveFaceOrder] = useCardOrder();
  const shownHand = useMemo(
    () => arrangeHand(hand.filter((c) => c !== pending), ctx, prefs.handSort, faceOrder),
    [hand, pending, ctx.mode, ctx.schweinchen, prefs.handSort, faceOrder], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const reorder = (cards: Card[]) => {
    // Ausgangspunkt ist die gerade gezeigte Ordnung, damit ein Wechsel von einer Vorlage nahtlos ist
    const base = prefs.handSort === 'custom' && faceOrder ? faceOrder : orderFromHand(faceOrder ?? defaultFaceOrder(), shownHand);
    saveFaceOrder(updateFaceOrder(base, shownHand, cards));
    if (prefs.handSort !== 'custom') setPref('handSort', 'custom');
  };
  const cycleSort = () => {
    const keys = Object.keys(HAND_SORT_LABELS) as HandSort[];
    const next = keys[(keys.indexOf(prefs.handSort) + 1) % keys.length];
    setPref('handSort', next);
  };

  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const myTurnToPlay = view.phase === 'playing' && view.turn === myPos && !pending && !view.collectPending;
  // Ohne Hervorhebung ("schwarz spielen") ist jede Karte wählbar; der Server prüft das Bedienen
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
  // Wer gerade angesagt hat (für die Katzen der Bots), verschwindet nach ein paar Sekunden
  const [announcer, setAnnouncer] = useState<number | null>(null);
  useEffect(() => {
    if (announcer === null) return;
    const t = setTimeout(() => setAnnouncer(null), 3500);
    return () => clearTimeout(t);
  }, [announcer]);
  const cats = useFx('cats') && giphyEnabled;

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
    if (now.ann > prev.ann) {
      // Neue Ansagen: Fanfare und vorlesen ("Re!", "Keine 90!")
      const fresh = view.announcementLog.slice(prev.ann);
      sound.announce(fresh[fresh.length - 1]?.party ?? null);
      for (const a of fresh) sound.say(`${levelLabel(a.level, a.party)}!`);
      setAnnouncer(fresh[fresh.length - 1]?.pos ?? null);
    }
    if (now.turn && !prev.turn) sound.turn();
  });
  // ---- Trumpf-Einschlag: Dulle, Kreuz-Dame oder Schweinchen knallen auf den Tisch ----
  const effects = useFx('impact');
  const momentsOn = useFx('moments');
  const [tableRef, animateTable] = useAnimate<HTMLElement>();
  const [impact, setImpact] = useState<{ key: string; rel: Rel } | null>(null);
  const seenCards = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = currentPlays.map(({ card }) => `${game.id}:${card}`);
    // Beim Öffnen der Seite liegende Karten nicht nachträglich knallen lassen
    if (!seenCards.current) {
      seenCards.current = new Set(ids);
      return;
    }
    const trickCtx = { mode: trumpMode(view), schweinchen: false };
    const leader = view.current?.leader ?? 0;
    currentPlays.forEach(({ card, rel: r }, i) => {
      const id = ids[i];
      if (seenCards.current!.has(id)) return;
      seenCards.current!.add(id);
      const by = card === pending ? myPos : (leader + i) % 4;
      const face = faceOf(card);
      const big =
        (isTrump(card, trickCtx) && (face === 'H-10' || face === 'C-Q')) ||
        (face === 'D-A' && (view.schweinchen === by || (by === myPos && hasSchweinchen(view, hand))));
      if (!big) return;
      sound.slam();
      if (!effects) return;
      setImpact({ key: id, rel: r });
      setTimeout(() => setImpact((cur) => (cur?.key === id ? null : cur)), 900);
      if (tableRef.current) {
        animateTable(tableRef.current, { x: [0, -7, 6, -4, 2, 0], y: [0, 4, -3, 2, -1, 0] }, { duration: 0.42, ease: 'easeOut' });
      }
    });
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
    if (!prev || prev.game !== now.game || !momentsOn) return;
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
  const [leaveOpen, setLeaveOpen] = useState(false);
  // Tasten: S = Sortierung wechseln, P = Punkte und Regeln
  const shortcuts = useRef({ cycleSort: () => {}, toggleSidebar: () => {}, react: (_k: ReactionKind) => {} });
  shortcuts.current = { cycleSort, toggleSidebar: () => setSidebarOpen((o) => !o), react: (k) => reactions?.send(k) };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || el?.closest?.('input, textarea, select, [contenteditable]')) return;
      const digit = /^Digit([1-4])$/.exec(e.code);
      if (digit && myPos >= 0) shortcuts.current.react(REACTION_KINDS[Number(digit[1]) - 1]);
      else if (e.code === 'KeyS' && myPos >= 0) shortcuts.current.cycleSort();
      else if (e.code === 'KeyP') shortcuts.current.toggleSidebar();
      else if (e.code === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [myPos]);
  // Handy (hochkant oder sehr niedrig quer): eigenes, gestapeltes Layout
  const mobile = vp.w < 760 || vp.h < 480;

  // Der Tisch füllt den freien Platz in der Mitte: Breite reicht für 5 Karten, Höhe für 2,2 Karten plus Beschriftung
  const [trickCell, setTrickCell] = useState<HTMLDivElement | null>(null);
  const cell = useElementSize(trickCell);
  const fit = cell ? Math.min(cell.w / 5.1, (cell.h - 26) / (CARD_RATIO * 2.2)) : Infinity;
  const trickCardW = mobile
    ? Math.round(Math.max(40, Math.min(72, (vp.w - 24) / 5.1, fit)))
    : Math.round(Math.max(56, Math.min(116, vp.w * 0.075, fit)));
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

  const PILE: Record<Rel, { side: 'left' | 'right'; v: 'above' | 'below' }> = {
    0: { side: 'right', v: 'above' },
    1: { side: 'right', v: 'below' },
    2: { side: 'left', v: 'below' },
    3: { side: 'left', v: 'above' },
  };
  const seatFor = (r: Rel, compact = false) => {
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
        online={isMe || isBot(uid) || online.includes(uid)}
        connecting={!isMe && online.includes(uid) && remotes[uid]?.status === 'connecting'}
        pile={compact ? undefined : { ...PILE[r], cardW: Math.round(trickCardW * 0.62) }}
        compact={compact}
        media={cats && isBotSeat(uid) ? <BotCat mood={moodOf(view, pos, announcer)} bot={botIndex(uid, r)} /> : undefined}
        reaction={reactions?.shown[uid]}
        title={members.find((m) => m.user_id === uid)?.title}
        badges={members.find((m) => m.user_id === uid)?.showcase}
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
    } else if (pendingTrick && canForceCollect) {
      panel = (
        <motion.div key="force-collect" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <button className="btn-secondary px-3 py-1.5" onClick={collect} disabled={busy}>
            Stich wegräumen
          </button>
        </motion.div>
      );
    }
  }
  // Einziger Hinweis: nach 5 Sekunden ohne Aktion, was die Leertaste gerade tut
  const hint = iCollect ? (
    <SpaceHint active resetKey={`c:${shownTrick.key}`} label="Stich nehmen" touchLabel="Stich antippen zum Nehmen" />
  ) : myTurnToPlay && selectedCard ? (
    <SpaceHint active resetKey={`p:${selectedCard}`} label="Karte ausspielen" touchLabel="Nochmal antippen zum Ausspielen" />
  ) : myTurnToPlay ? (
    <SpaceHint active resetKey={`w:${trickCount}`} keys={['←', '→']} label="Karte wählen" touchLabel="Karte antippen" />
  ) : null;

  const announcementText = (['re', 'kontra'] as const)
    .filter((p) => view.announcements[p] !== null)
    .map((p) => `${partyLabel(p)}${view.announcements[p] !== 120 ? `: ${levelLabel(view.announcements[p]!, p)}` : ''}`)
    .join(' · ');

  const titles = useMemo(() => eveningTitles(results, finishedGames), [results, finishedGames]);
  const sidebar = (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4">
      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wider text-white/50 uppercase">Punkte heute</h3>
        <ScoreSheet results={results} members={members} me={me} />
      </section>
      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wider text-white/50 uppercase">Letzte Spiele</h3>
        <RecentGames games={finishedGames} name={nameOfUser} />
      </section>
      {titles.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wider text-white/50 uppercase">Titel des Abends</h3>
          <ul className="space-y-1.5 text-sm">
            {titles.map((t) => (
              <li key={t.title} className="flex items-center justify-between gap-3" title={t.hint}>
                <span className="flex items-center gap-2 text-white/70">
                  <Crown className="size-3.5 text-gold-400" aria-hidden />
                  {t.title}
                </span>
                <span className="truncate text-right font-medium">{t.holders.map(nameOfUser).join(' & ')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <RulesPanel current={view.settings} rules={rules} />
      <div className="mt-auto flex flex-col gap-2">
        {onShowLobby && (
          <button className="btn-ghost" onClick={onShowLobby} disabled={!finished}>
            {finished ? 'Plätze & Regeln' : 'Plätze & Regeln (nach dem Spiel)'}
          </button>
        )}
      </div>
    </div>
  );

  const infoLine = (
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
  );

  const toolbar = (
    <div className="flex items-center gap-1">
      <button className="btn-ghost p-2" onClick={() => setSidebarOpen(true)} aria-label="Punkte und Regeln" data-cursor="Punkte">
        <ListOrdered className="size-4" />
      </button>
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
      {myPos >= 0 && (
        <button
          className="btn-ghost flex items-center gap-1.5 p-2"
          onClick={cycleSort}
          aria-label={`Sortierung: ${HAND_SORT_LABELS[prefs.handSort]} – wechseln`}
          title="Karten sortieren"
          data-cursor="Sortieren"
        >
          <ArrowDownUp className="size-4" />
          <span className="tag hidden text-[10px] text-white/55 sm:inline">{HAND_SORT_LABELS[prefs.handSort]}</span>
        </button>
      )}
      {reactions && myPos >= 0 && <ReactionPicker onReact={reactions.send} />}
      {onLeave && (
        <button className="btn-ghost p-2" onClick={() => setLeaveOpen(true)} aria-label="Spiel verlassen" data-cursor="Verlassen">
          <LogOut className="size-4" />
        </button>
      )}
    </div>
  );

  // Wer den Stich eröffnet (hat)
  const leaderPos = view.phase === 'playing' && view.current ? view.current.leader : null;
  const leaderLabel =
    leaderPos === null
      ? undefined
      : shownTrick.plays.length === 0
        ? leaderPos === myPos
          ? 'Du spielst aus'
          : `${name(leaderPos)} spielt aus`
        : leaderPos === myPos
          ? 'Du hast ausgespielt'
          : `${name(leaderPos)} hat ausgespielt`;

  const trickArea = (
    <TrickArea
      trickKey={shownTrick.key}
      plays={shownTrick.plays}
      winnerRel={shownTrick.winner === null ? null : rel(shownTrick.winner)}
      winnerLabel={
        shownTrick.winner === null ? undefined : shownTrick.winner === myPos ? 'Dein Stich' : `Stich für ${name(shownTrick.winner)}`
      }
      leaderLabel={leaderLabel}
      cardWidth={trickCardW}
      onCollect={iCollect ? collect : undefined}
      impact={impact}
    >
      <MomentOverlay moment={moments.current} />
    </TrickArea>
  );

  const handEl = myPos >= 0 && (
    <Hand
      cards={shownHand}
      dealKey={game.id}
      mode={view.phase === 'armutReturn' && isRichReturning ? 'pick' : view.phase === 'playing' ? 'play' : 'view'}
      playable={playable}
      picked={picked}
      highlight={newCards}
      maxCardW={mobile ? 84 : 124}
      onPick={(c) =>
        setPicked((cur) => {
          const next = new Set(cur);
          if (next.has(c)) next.delete(c);
          else if (next.size < 3) next.add(c);
          return next;
        })
      }
      onPlay={play}
      onSelect={setSelectedCard}
      onReorder={reorder}
    />
  );

  const announceEl = announce.length > 0 && (
    <AnnouncePanel
      options={announce}
      party={party}
      busy={busy}
      row={mobile}
      onAnnounce={(level: AnnounceLevel) => run(() => act({ type: 'announce', level }))}
    />
  );

  const lastTrick = view.phase === 'playing' && (
    <LastTrick trick={view.collectPending ? view.previousTrick : view.lastTrick} name={name} cardW={mobile ? 30 : 44} />
  );

  const sittingOutTiles = sittingOut.map((m) => (
    <VideoTile
      key={m.user_id}
      stream={streamOf(m.user_id)}
      name={m.display_name}
      mirror={m.user_id === me}
      videoOff={m.user_id === me && !camera.enabled}
      className={`aspect-[4/3] ${mobile ? 'w-24' : 'w-40'}`}
    >
      <div className="tag absolute bottom-1.5 left-1.5 rounded bg-felt-950/75 px-1.5 py-0.5 text-[10px]">
        {m.display_name}
        {m.user_id === me && ' (du)'} · setzt aus
      </div>
    </VideoTile>
  ));

  return (
    // overflow-hidden: einfliegende Karten und das Beben dürfen keine Scrollbalken erzeugen
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {mobile ? (
        // Handy: Kameras klein in einer Reihe, darunter der Stich, unten die Hand
        <main ref={tableRef} className="felt relative isolate flex min-w-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto px-2 pt-1 pb-2">
          <Atmosphere />
          <div className="grid grid-cols-4 gap-1.5">
            {seatFor(1, true)}
            {seatFor(2, true)}
            {seatFor(3, true)}
            {seatFor(0, true)}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">{infoLine}</div>
            {toolbar}
          </div>
          {(lastTrick || sittingOutTiles.length > 0) && (
            <div className="flex items-start justify-center gap-3">
              {lastTrick}
              {sittingOutTiles}
            </div>
          )}
          {/* overflow-clip: einfliegende Karten lassen die Seite nicht scrollen */}
          <div ref={setTrickCell} className="grid min-h-0 flex-1 place-items-center overflow-clip pt-5">
            {trickArea}
          </div>
          <div className="flex min-h-11 flex-col items-center justify-end gap-2">
            <AnimatePresence mode="wait">{panel}</AnimatePresence>
            {hint}
            {announceEl}
          </div>
          {handEl}
        </main>
      ) : (
      <main
        ref={tableRef}
        className="felt relative isolate grid min-w-0 flex-1 gap-3 overflow-hidden p-3"
        style={{ gridTemplateColumns: `${camW}px minmax(0, 1fr) ${camW}px`, gridTemplateRows: 'auto minmax(0, 1fr) auto' }}
      >
        <Atmosphere />

        {/* Oben links: Spieler links von mir */}
        <div className="relative z-10 self-start">{seatFor(1)}</div>

        {/* Oben Mitte: Infoleiste und wer aussetzt */}
        <div className="relative z-10 flex min-w-0 flex-col items-center gap-3 self-start">
          {infoLine}
          {toolbar}
          {lastTrick}
          {sittingOutTiles}
        </div>

        {/* Oben rechts: gegenüber */}
        <div className="relative z-10 self-start">{seatFor(2)}</div>

        {/* Mitte: der Stich */}
        {/* z-0: Die Tischmitte liegt hinter Hand und Aktionen – aufgeklappte Vorbehalte verschwinden nie dahinter */}
        <div ref={setTrickCell} className="relative z-0 col-span-3 grid min-h-0 place-items-center">
          {trickArea}
        </div>

        {/* Unten links: ich – oder, wenn ich aussetze, wer nach mir sitzt */}
        <div className="relative z-10 self-end">{seatFor(0)}</div>

        {/* Unten Mitte: Hand, Aktionen, Ansagen */}
        <div className="relative z-20 flex min-w-0 items-end gap-3 self-end">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex min-h-11 flex-col items-center justify-end gap-2">
              <AnimatePresence mode="wait">{panel}</AnimatePresence>
              {hint}
            </div>
            {handEl}
          </div>
          {announceEl && <div className="w-28 shrink-0 self-center">{announceEl}</div>}
        </div>

        {/* Unten rechts: Spieler rechts von mir */}
        <div className="relative z-10 self-end">{seatFor(3)}</div>

        {/* Kartenübersicht (Einstellung): rechts zwischen den beiden Kameras */}
        {prefs.cardGuide && (
          <div className="pointer-events-none absolute top-1/2 right-3 z-10 -translate-y-1/2" style={{ width: camW }}>
            <CardGuide width={camW} withNines={view.settings.withNines} />
          </div>
        )}
      </main>
      )}

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
                className="fixed inset-y-0 right-0 z-50 w-[26rem] max-w-[92vw] border-l border-white/10 bg-felt-950/95"
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

      {achievementFeed && <AchievementBanner event={achievementFeed.current} name={nameOfUser} onDone={achievementFeed.done} />}

      <LeaveDialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        onLeave={onLeave}
        practice={!onAbort}
        onAbort={onAbort && myPos >= 0 && game.status === 'running' ? onAbort : undefined}
      />

      <AnimatePresence>
        {showResult && (
          <ResultDialog
            view={view}
            name={name}
            myPos={myPos}
            busy={busy}
            canStart={members.length >= 1 && members.length <= 5}
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

/** Hausregeln in der Seitenleiste: Übersicht, für den Gastgeber zwischen den Spielen bearbeitbar. */
function RulesPanel({
  current,
  rules,
}: {
  current: RuleSettings;
  rules?: { value: RuleSettings; locked: string | null; onSave: (s: RuleSettings) => Promise<void>; bots?: boolean };
}) {
  const [draft, setDraft] = useState<RuleSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const shown = rules?.value ?? current;
  const changed = JSON.stringify(shown) !== JSON.stringify(current);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wider text-white/50 uppercase">Hausregeln</h3>
        {rules && !draft && (
          <button
            className="btn-ghost tag px-2 py-1 text-[10px]"
            onClick={() => setDraft(rules.value)}
            disabled={!!rules.locked}
            title={rules.locked ?? undefined}
          >
            Anpassen
          </button>
        )}
      </div>
      {draft ? (
        <div>
          <RulesForm value={draft} onChange={setDraft} narrow bots={rules?.bots ?? true} />
          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setDraft(null)}>
              Abbrechen
            </button>
            <button
              className="btn-primary"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await rules!.onSave(draft);
                  setDraft(null);
                } finally {
                  setSaving(false);
                }
              }}
            >
              Speichern
            </button>
          </div>
        </div>
      ) : (
        <>
          <ul className="flex flex-wrap gap-1.5">
            {rulesSummary(shown).map((s) => (
              <li key={s} className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/75">
                {s}
              </li>
            ))}
          </ul>
          {changed && <p className="mt-2 text-xs text-gold-300">Gilt ab dem nächsten Spiel.</p>}
          {rules?.locked && <p className="tag mt-2 text-[10px] text-white/35">{rules.locked}</p>}
        </>
      )}
    </section>
  );
}
