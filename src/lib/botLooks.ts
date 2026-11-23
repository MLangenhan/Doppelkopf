import { BOT_IDS } from '@engine';
import { Battery, Bot, Bug, Calculator, Cpu, Hourglass, type LucideIcon, Radio, RefreshCw, ScanEye, Wrench, Zap } from 'lucide-react';

/** Eigene Titel und Abzeichen der Bots – nur zum Spaß, nicht kaufbar und nicht verdienbar */
export const BOT_TITLES: Record<string, string> = {
  'bot:clanker': 'Clanker',
  'bot:rechnet': 'Rechnet noch …',
  'bot:blech': 'Blechbüchse mit Ambitionen',
  'bot:404': '404: Dulle not found',
};

export const BOT_BADGES: Record<string, { icon: LucideIcon; label: string; color: string }> = {
  'bot:kartoffel': { icon: Cpu, label: 'Läuft auf einer Kartoffel-CPU', color: '#a3a3a3' },
  'bot:oel': { icon: Wrench, label: 'Braucht dringend Öl', color: '#d6b35a' },
  'bot:echt': { icon: Bot, label: 'Kein Mensch – versprochen', color: '#7dd3fc' },
  'bot:laedt': { icon: Hourglass, label: 'Lädt seit 1998', color: '#c4b5fd' },
  'bot:zaehlt': { icon: Calculator, label: 'Zählt Karten (natürlich)', color: '#86efac' },
  'bot:strom': { icon: Zap, label: 'Trinkt nur Strom', color: '#fde047' },
  'bot:akku': { icon: Battery, label: 'Akku bei 3 %', color: '#fca5a5' },
  'bot:blick': { icon: ScanEye, label: 'Guckt nie in fremde Karten (angeblich)', color: '#93c5fd' },
  'bot:feature': { icon: Bug, label: 'Das ist kein Bug, das ist ein Feature', color: '#f9a8d4' },
  'bot:neustart': { icon: RefreshCw, label: 'Hat’s schon mit Aus- und Einschalten versucht', color: '#a5f3fc' },
  'bot:funk': { icon: Radio, label: 'Funkt nach Hause', color: '#fdba74' },
};

const LOOKS = [
  { title: 'bot:clanker', badges: ['bot:kartoffel', 'bot:oel', 'bot:echt'] },
  { title: 'bot:rechnet', badges: ['bot:laedt', 'bot:zaehlt', 'bot:strom'] },
  { title: 'bot:blech', badges: ['bot:akku', 'bot:blick', 'bot:echt'] },
  { title: 'bot:404', badges: ['bot:feature', 'bot:neustart', 'bot:funk'] },
];

/** Titel und Abzeichen eines Bots (feste IDs online, „bot-1“ … in der Übung) */
export function botLook(uid: string): { title: string; badges: string[] } | null {
  const i = uid.startsWith('bot-') ? Number(uid.slice(4)) - 1 : BOT_IDS.indexOf(uid);
  return i >= 0 ? (LOOKS[i % LOOKS.length] ?? null) : null;
}
