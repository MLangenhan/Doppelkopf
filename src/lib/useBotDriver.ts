import { actorOf, isBot } from '@engine';
import { useEffect, useState } from 'react';
import { api, type GameRow } from './supabase';

/** Pausen, damit man den Bots folgen kann (die Rechenzeit am Server kommt noch dazu) */
const DELAY = { collect: 1900, declare: 700, play: 800 };
/** Wer nicht als Erster dran ist, springt erst ein, wenn der andere hängt */
const FALLBACK = 3500;

/**
 * Bots an echten Tischen ziehen am Server, angestoßen von den Browsern am Tisch:
 * Der erste anwesende Mensch (in Sitzreihenfolge) stößt den Zug nach einer kurzen Pause an,
 * die anderen nur als Reserve. Doppelte Anstöße lehnt der Server ab (Versionsprüfung).
 */
export function useBotDriver(game: GameRow | null, me: string | null, online: string[], reload?: () => Promise<void>) {
  const [retry, setRetry] = useState(0);
  const state = game?.state;
  const pos = game && game.status === 'running' && state ? actorOf(state) : null;
  const botTurn = pos !== null && !!game && isBot(game.players[pos]);
  const humans = game ? game.players.filter((u) => !isBot(u)) : [];
  const driver = humans.find((u) => u === me || online.includes(u));
  const key = game ? `${game.id}:${game.version}:${retry}` : '';

  useEffect(() => {
    if (!botTurn || !game || !me) return;
    const base = state!.collectPending ? DELAY.collect : state!.phase === 'playing' ? DELAY.play : DELAY.declare;
    const wait = base + (driver === me ? 0 : FALLBACK);
    const t = setTimeout(async () => {
      try {
        await api.botStep(game.id);
        await reload?.();
      } catch (e) {
        // "Jemand war schneller" oder "schaut sich den Stich noch an": kurz darauf nochmal schauen
        console.debug('Bot-Zug', (e as Error).message);
        setTimeout(() => setRetry((r) => r + 1), 600);
      }
    }, wait);
    return () => clearTimeout(t);
  }, [key, botTurn]); // eslint-disable-line react-hooks/exhaustive-deps
}
