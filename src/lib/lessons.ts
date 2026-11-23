import { type AnnounceLevel, type Card, effectiveSuit } from '@engine';
import {
  ArrowDownWideNarrow,
  Calculator,
  Check,
  Coins,
  Copy,
  Eye,
  Flame,
  Gem,
  HandCoins,
  Heart,
  Layers,
  ListOrdered,
  type LucideIcon,
  Megaphone,
  PawPrint,
  Play,
  Repeat,
  Shield,
  Sparkles,
  Target,
  Trophy,
  User,
  Users,
  Zap,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Lernkarten: ein Begriff, ein Icon, höchstens zwei Aspekte
// ---------------------------------------------------------------------------

export type ConceptKey =
  | 'pairs'
  | 'trick'
  | 'lead'
  | 'follow'
  | 'cantFollow'
  | 'trump'
  | 'specials'
  | 'winnerLeads'
  | 'followTrump'
  | 'doubles'
  | 'fehlOrder'
  | 'order'
  | 'dulle'
  | 'equal'
  | 'reveal'
  | 'announce'
  | 'kontra'
  | 'keine90'
  | 'hochzeit'
  | 'solo'
  | 'armut'
  | 'augen'
  | 'win121'
  | 'doppelkopf'
  | 'fuchs'
  | 'karlchen'
  | 'scoring';

export interface Concept {
  stage: 1 | 2 | 3 | 4;
  icon: LucideIcon;
  title: string;
  /** Höchstens zwei kurze Aspekte */
  points: [string] | [string, string];
  /** Welche Karten in der Hand beim Lesen markiert werden */
  focus?: 'ledSuit' | 'trumps';
}

export const CONCEPTS: Record<ConceptKey, Concept> = {
  pairs: { stage: 1, icon: Users, title: 'Zwei gegen zwei', points: ['Wer eine Kreuz-Dame hat, spielt „Re“ – die anderen „Kontra“.', 'Wer dein Partner ist, weißt du am Anfang nicht.'] },
  trick: { stage: 1, icon: Layers, title: 'Der Stich', points: ['Reihum legt jeder eine Karte in die Mitte.', 'Die stärkste gewinnt den Stich.'] },
  lead: { stage: 1, icon: Play, title: 'Ausspielen', points: ['Wer beginnt, darf jede Karte legen.', 'Die erste Karte bestimmt, was bedient werden muss.'] },
  follow: {
    stage: 1,
    icon: Check,
    title: 'Bedienen',
    points: ['Ist eine Farbe ausgespielt, musst du bedienen – also die gleiche Farbe spielen.', 'Die markierten Karten in der Hand sind die, die passen.'],
    focus: 'ledSuit',
  },
  cantFollow: { stage: 1, icon: Zap, title: 'Nicht bedienen können', points: ['Hast du die ausgespielte Farbe nicht, darfst du jede andere Karte legen – auch eine andere Farbe.', 'Mit Trumpf kannst du den Stich sogar holen: Trumpf schlägt jede Farbe.'] },
  trump: {
    stage: 1,
    icon: Sparkles,
    title: 'Trumpf',
    points: ['Alle Damen, alle Buben, alle Karo-Karten und die Herz-10 – markiert in der Hand.', 'Trumpf ist stärker als Kreuz, Pik und Herz.'],
    focus: 'trumps',
  },
  followTrump: {
    stage: 1,
    icon: Check,
    title: 'Trumpf bedienen',
    points: ['Ist Trumpf ausgespielt, musst du Trumpf zugeben – markiert in der Hand.', 'Herz-10 und Damen zählen dabei als Trumpf, nicht als Farbe.'],
    focus: 'ledSuit',
  },
  specials: { stage: 1, icon: Flame, title: 'Besondere Karten', points: ['Herz-10 „Dulle“: höchster Trumpf · Kreuz-Dame: zeigt Re.', 'Karo-Ass „Fuchs“ und Kreuz-Bube „Karlchen“ bringen später Extrapunkte.'] },
  winnerLeads: { stage: 1, icon: Repeat, title: 'Wer gewinnt, fängt an', points: ['Der Gewinner nimmt den Stich.', 'Und spielt den nächsten aus.'] },
  doubles: {
    stage: 2,
    icon: Copy,
    title: 'Alles doppelt',
    points: [
      'Jede Karte gibt es zweimal – daher der Name „Doppelkopf“.',
      'Herz hat nur vier Karten (die Herz-10 ist Trumpf). Darum geht der erste Herz-Stich selten rum – einer kann nicht bedienen und sticht.',
    ],
  },
  fehlOrder: { stage: 2, icon: ArrowDownWideNarrow, title: 'Reihenfolge der Farben', points: ['In Kreuz, Pik und Herz gilt: Ass › Zehn › König.', 'Die Zehn ist also stärker als der König.'] },
  order: { stage: 2, icon: ListOrdered, title: 'Trumpf-Rangfolge', points: ['Herz-10 › Damen › Buben › Karo-Ass › Karo-10 › Karo-König.', 'Damen und Buben: Kreuz › Pik › Herz › Karo.'] },
  dulle: { stage: 2, icon: Flame, title: 'Zwei Dullen', points: ['Die Herz-10 ist der höchste Trumpf.', 'Liegen beide im Stich, gewinnt hier die erste.'] },
  equal: { stage: 2, icon: Copy, title: 'Gleiche Karten', points: ['Liegen beide Exemplare einer Karte im Stich …', '… gewinnt die zuerst gespielte.'] },
  reveal: { stage: 3, icon: Eye, title: 'Partner erkennen', points: ['Wer eine Kreuz-Dame spielt, verrät: „Ich bin Re.“', 'Sobald beide liegen, stehen die Paare fest.'] },
  announce: { stage: 3, icon: Megaphone, title: 'Ansage „Re“', points: ['Mit einer Kreuz-Dame kannst du früh „Re“ ansagen.', 'Das verrät deine Partei und verdoppelt den Einsatz.'] },
  kontra: { stage: 3, icon: Megaphone, title: 'Ansage „Kontra“', points: ['Die Gegenseite kann mit „Kontra“ dagegenhalten.', 'Auch das verdoppelt den Einsatz.'] },
  keine90: { stage: 3, icon: Target, title: 'Keine 90', points: ['Wer mehr wagt, sagt „Keine 90“: Die Gegner holen keine 90 Augen.', 'Klappt es nicht, verliert die ansagende Seite.'] },
  hochzeit: { stage: 3, icon: Heart, title: 'Hochzeit', points: ['Beide Kreuz-Damen auf einer Hand.', 'Wer den ersten fremden Stich gewinnt, wird Partner.'] },
  solo: { stage: 3, icon: User, title: 'Solo', points: ['Einer spielt allein gegen drei.', 'Er bestimmt, was Trumpf ist – z. B. nur Damen.'] },
  armut: { stage: 3, icon: HandCoins, title: 'Armut', points: ['Höchstens drei Trümpfe? Dann darfst du sie abgeben.', 'Wer sie nimmt, gibt Karten zurück und spielt mit dir.'] },
  augen: { stage: 4, icon: Coins, title: 'Augen zählen', points: ['Ass 11 · Zehn 10 · König 4 · Dame 3 · Bube 2.', 'Zusammen sind 240 Augen im Spiel.'] },
  win121: { stage: 4, icon: Trophy, title: 'Gewinnen', points: ['Re braucht 121 Augen, Kontra reichen 120.', 'Die Augen aller Stiche einer Partei werden addiert.'] },
  doppelkopf: { stage: 4, icon: Gem, title: 'Doppelkopf', points: ['Ein Stich mit 40 Augen oder mehr.', 'Bringt dem Gewinner einen Extrapunkt.'] },
  fuchs: { stage: 4, icon: PawPrint, title: 'Fuchs gefangen', points: ['Holt eine Partei das Karo-Ass der Gegner …', '… bekommt sie einen Extrapunkt.'] },
  karlchen: { stage: 4, icon: Shield, title: 'Karlchen', points: ['Gewinnt der Kreuz-Bube den letzten Stich …', '… gibt es einen Extrapunkt.'] },
  scoring: { stage: 4, icon: Calculator, title: 'Punkte am Ende', points: ['Gewonnen: +1 Punkt, dazu Extrapunkte und Ansagen.', 'Die Verlierer bekommen dieselben Punkte als Minus.'] },
};

export const STAGES = [
  { stage: 1, title: 'Grundlagen', icon: Users, blurb: 'Paare, Stiche, Trumpf und die besonderen Karten' },
  { stage: 2, title: 'Rangfolge', icon: ListOrdered, blurb: 'Welche Karte schlägt welche?' },
  { stage: 3, title: 'Spielarten & Ansagen', icon: Megaphone, blurb: 'Partner erkennen, Re und Kontra, Sonderspiele' },
  { stage: 4, title: 'Punkte', icon: Coins, blurb: 'Augen zählen, gewinnen und Extrapunkte' },
] as const;

// ---------------------------------------------------------------------------
// Lektionen: feste Blätter und ein Drehbuch (wie im Hearthstone-Tutorial)
// ---------------------------------------------------------------------------

export type Beat =
  | { t: 'card'; concept: ConceptKey }
  | { t: 'title'; text: string; sub?: string }
  | { t: 'play'; pos: number; card: Card }
  | { t: 'announce'; pos: number; level: AnnounceLevel }
  | { t: 'collect' }
  | { t: 'end' };

export interface Lesson {
  stage: 1 | 2 | 3 | 4;
  /** Wer zuerst dran ist (Position 0 = du) */
  starter: number;
  hands: Card[][];
  beats: Beat[];
}

const SUITS = ['C', 'S', 'H', 'D'];
const RANKS = ['10', 'J', 'Q', 'K', 'A'];
const DECK: Card[] = SUITS.flatMap((s) => RANKS.flatMap((r) => [`${s}-${r}-0`, `${s}-${r}-1`]));
const NORMAL = { mode: 'normal' as const, schweinchen: false };

/**
 * Verteilt die übrigen Karten auf die vorgegebenen Hände (je 10).
 * voids: Fehlfarben, die ein Spieler nicht bekommen darf (damit er im Drehbuch nicht bedienen kann).
 */
function deal(fixed: Card[][], voids: string[][] = [[], [], [], []]): Card[][] {
  const hands = fixed.map((h) => [...h]);
  const used = new Set(hands.flat());
  for (const c of DECK) {
    if (used.has(c)) continue;
    const suit = effectiveSuit(c, NORMAL);
    // Gleichmäßig verteilen: an den erlaubten Spieler mit den wenigsten Karten
    const allowed = [0, 1, 2, 3].filter((i) => hands[i].length < 10 && !(suit !== 'T' && voids[i].includes(suit)));
    if (!allowed.length) throw new Error(`Karte ${c} passt nirgends`);
    const p = allowed.reduce((a, b) => (hands[b].length < hands[a].length ? b : a));
    hands[p].push(c);
  }
  return hands;
}

const play = (pos: number, card: Card): Beat => ({ t: 'play', pos, card });
const card = (concept: ConceptKey): Beat => ({ t: 'card', concept });
const collect: Beat = { t: 'collect' };

export const LESSONS: Lesson[] = [
  // Stufe 1: Grundlagen – Ausspielen, Bedienen, andere Farbe legen, Stechen, Trumpf bedienen, Sonderkarten
  {
    stage: 1,
    starter: 0,
    hands: deal(
      [
        ['H-A-0', 'C-A-0', 'H-10-0', 'C-Q-0', 'D-A-1', 'S-Q-0'],
        ['H-K-0', 'C-10-0', 'D-J-0', 'D-A-0'],
        ['H-K-1', 'D-10-0', 'D-K-0', 'C-Q-1', 'H-J-0'],
        ['S-K-0', 'C-K-0', 'S-Q-1', 'H-10-1', 'D-Q-1'],
      ],
      [[], [], ['C'], ['H']],
    ),
    beats: [
      { t: 'title', text: 'Lektion 1', sub: 'Grundlagen' },
      card('pairs'),
      card('trick'),
      card('lead'),
      play(0, 'H-A-0'),
      card('follow'),
      play(1, 'H-K-0'),
      play(2, 'H-K-1'),
      card('cantFollow'),
      play(3, 'S-K-0'),
      collect,
      card('winnerLeads'),
      play(0, 'C-A-0'),
      play(1, 'C-10-0'),
      card('trump'),
      play(2, 'D-10-0'),
      play(3, 'C-K-0'),
      collect,
      play(2, 'D-K-0'),
      play(3, 'S-Q-1'),
      card('followTrump'),
      card('specials'),
      play(0, 'H-10-0'),
      play(1, 'D-J-0'),
      collect,
      play(0, 'C-Q-0'),
      play(1, 'D-A-0'),
      play(2, 'H-J-0'),
      play(3, 'D-Q-1'),
      collect,
      { t: 'end' },
    ],
  },
  // Stufe 2: Rangfolge – Farben, Trumpf-Reihenfolge, Dulle, gleiche Karten
  {
    stage: 2,
    starter: 0,
    hands: deal(
      [
        ['C-K-0', 'H-Q-0', 'H-10-0', 'S-A-0', 'C-Q-0'],
        ['C-10-0', 'D-Q-0', 'H-10-1', 'S-A-1'],
        ['C-A-0', 'S-J-0', 'D-A-0', 'S-10-0', 'C-Q-1'],
        ['C-K-1', 'C-J-0', 'S-Q-0', 'S-K-0'],
      ],
      [[], [], [], []],
    ),
    beats: [
      { t: 'title', text: 'Lektion 2', sub: 'Rangfolge' },
      card('doubles'),
      card('fehlOrder'),
      play(0, 'C-K-0'),
      play(1, 'C-10-0'),
      play(2, 'C-A-0'),
      play(3, 'C-K-1'),
      collect,
      play(2, 'S-J-0'),
      play(3, 'C-J-0'),
      card('order'),
      play(0, 'H-Q-0'),
      play(1, 'D-Q-0'),
      collect,
      card('dulle'),
      play(0, 'H-10-0'),
      play(1, 'H-10-1'),
      play(2, 'D-A-0'),
      play(3, 'S-Q-0'),
      collect,
      card('equal'),
      play(0, 'S-A-0'),
      play(1, 'S-A-1'),
      play(2, 'S-10-0'),
      play(3, 'S-K-0'),
      collect,
      { t: 'end' },
    ],
  },
  // Stufe 3: Spielarten & Ansagen – Re ansagen, Partner erkennen, Kontra, Sonderspiele
  {
    stage: 3,
    starter: 0,
    hands: deal(
      [
        ['C-Q-0', 'H-A-0', 'D-K-0', 'S-J-0'],
        ['D-Q-0', 'H-K-0', 'D-J-0', 'C-J-0'],
        ['C-Q-1', 'H-K-1', 'D-10-0', 'H-J-0'],
        ['S-Q-0', 'H-A-1', 'D-K-1', 'C-J-1'],
      ],
      [[], [], [], []],
    ),
    beats: [
      { t: 'title', text: 'Lektion 3', sub: 'Spielarten & Ansagen' },
      card('announce'),
      { t: 'announce', pos: 0, level: 120 },
      card('reveal'),
      play(0, 'C-Q-0'),
      card('kontra'),
      { t: 'announce', pos: 1, level: 120 },
      play(1, 'D-Q-0'),
      play(2, 'C-Q-1'),
      { t: 'title', text: 'Die Paare stehen fest', sub: 'Beide Kreuz-Damen liegen' },
      play(3, 'S-Q-0'),
      collect,
      card('keine90'),
      play(0, 'H-A-0'),
      play(1, 'H-K-0'),
      play(2, 'H-K-1'),
      play(3, 'H-A-1'),
      collect,
      card('hochzeit'),
      card('solo'),
      card('armut'),
      { t: 'end' },
    ],
  },
  // Stufe 4: Punkte – Augen, Doppelkopf, Fuchs, Karlchen, Abrechnung
  {
    stage: 4,
    starter: 0,
    hands: deal(
      [
        ['C-A-0', 'H-10-0', 'C-Q-0', 'S-K-0'],
        ['C-A-1', 'D-A-0', 'S-A-0'],
        ['C-10-0', 'D-Q-0', 'C-Q-1', 'S-10-0'],
        ['C-10-1', 'D-J-0', 'S-A-1'],
      ],
      [[], [], [], []],
    ),
    beats: [
      { t: 'title', text: 'Lektion 4', sub: 'Punkte' },
      card('augen'),
      play(0, 'C-A-0'),
      play(1, 'C-A-1'),
      play(2, 'C-10-0'),
      play(3, 'C-10-1'),
      card('doppelkopf'),
      collect,
      play(0, 'H-10-0'),
      card('fuchs'),
      play(1, 'D-A-0'),
      play(2, 'D-Q-0'),
      play(3, 'D-J-0'),
      collect,
      card('win121'),
      card('karlchen'),
      card('scoring'),
      { t: 'end' },
    ],
  },
];

export const lessonFor = (stage: number) => LESSONS.find((l) => l.stage === stage) ?? LESSONS[0];

/** Welche Lernkarten passen zu den Regeln, die in einem Stich gegriffen haben (für den Online-Lernmodus) */
export const RULE_CONCEPTS: Record<string, ConceptKey[]> = {
  pairs: ['pairs'],
  lead: ['trick', 'lead'],
  follow: ['follow'],
  free: ['cantFollow'],
  trump: ['trump'],
  trumpBeats: ['trump'],
  special: ['specials'],
  order: ['order'],
  equal: ['doubles', 'equal'],
  dulle: ['dulle'],
  spielart: [],
  ansagen: ['announce'],
  augen: ['augen', 'win121'],
  doppelkopf: ['doppelkopf'],
  fuchs: ['fuchs'],
  karlchen: ['karlchen'],
};
