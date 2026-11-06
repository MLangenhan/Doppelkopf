import { useEffect } from 'react';

// Controller-Unterstützung über die Gamepad-API. Jeder Knopf wird in die Taste übersetzt,
// die das Spiel ohnehin versteht – die Spiellogik kennt keinen Controller.
//
//   Steuerkreuz / linker Stick ← →   ← →   Karte wählen
//   Steuerkreuz / linker Stick ↑ ↓   Fokus zum vorigen / nächsten Knopf (Ansage, Vorbehalt, Dialoge)
//   A (✕)                            markierten Knopf drücken, sonst Leertaste
//   B (○)                            Esc
//   LB / RB                          Sortierung wechseln (S)
//   Start / Y (△)                    Punkte und Regeln (P)

const A = 0, B = 1, Y = 3, LB = 4, RB = 5, START = 9, UP = 12, DOWN = 13, LEFT = 14, RIGHT = 15;
const REPEAT_DELAY = 380;
const REPEAT_EVERY = 140;
const STICK = 0.55;

type Dir = 'up' | 'down' | 'left' | 'right';

function key(code: string, keyName: string) {
  const target = (document.activeElement as HTMLElement | null) ?? document.body;
  target.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, code, bubbles: true, cancelable: true }));
}

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Fokus zum vorigen/nächsten sichtbaren Knopf; in einem offenen Dialog nur innerhalb des Dialogs. Karten der Hand zählen nicht (die laufen über ← →). */
function moveFocus(dir: 1 | -1) {
  const dialogs = [...document.querySelectorAll<HTMLElement>('[role=dialog][aria-modal=true]')];
  const scope = dialogs[dialogs.length - 1] ?? document.body;
  const items = [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => !el.closest('[data-hand]') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden',
  );
  if (!items.length) return;
  const i = items.indexOf(document.activeElement as HTMLElement);
  const next = i < 0 ? items[dir > 0 ? 0 : items.length - 1] : items[(i + dir + items.length) % items.length];
  next.focus();
  next.scrollIntoView({ block: 'nearest' });
}

function press(button: number | Dir) {
  document.documentElement.classList.add('gamepad');
  switch (button) {
    case 'left':
    case 'right': {
      // Zurück zu den Karten: Fokus von Knöpfen lösen, damit A danach die Karte spielt und nicht z. B. ansagt
      const el = document.activeElement as HTMLElement | null;
      if (el && el !== document.body && !el.closest('[data-hand]') && !el.closest('[role=dialog]')) el.blur();
      return button === 'left' ? key('ArrowLeft', 'ArrowLeft') : key('ArrowRight', 'ArrowRight');
    }
    case 'up':
      return moveFocus(-1);
    case 'down':
      return moveFocus(1);
    case A: {
      const el = document.activeElement as HTMLElement | null;
      // Markierter Knopf außerhalb der Hand: drücken. Sonst wie die Leertaste (ausspielen, Stich nehmen …)
      if (el && el !== document.body && el.matches(FOCUSABLE) && !el.closest('[data-hand]')) el.click();
      else key('Space', ' ');
      return;
    }
    case B:
      return key('Escape', 'Escape');
    case LB:
    case RB:
      return key('KeyS', 's');
    case START:
    case Y:
      return key('KeyP', 'p');
  }
}

/** Fragt angeschlossene Controller ab, solange einer da ist. Einmal in der App einbinden. */
export function useGamepad() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('getGamepads' in navigator)) return;
    let raf = 0;
    const held = new Map<string, number>(); // Taste → Zeitpunkt der nächsten Wiederholung
    const loop = (now: number) => {
      const pads = navigator.getGamepads().filter((p): p is Gamepad => !!p && p.connected);
      if (!pads.length) {
        raf = 0;
        return;
      }
      const down = new Set<string>();
      for (const p of pads) {
        p.buttons.forEach((b, i) => b.pressed && down.add(String(i)));
        const [x = 0, y = 0] = p.axes;
        if (x < -STICK) down.add(String(LEFT));
        if (x > STICK) down.add(String(RIGHT));
        if (y < -STICK) down.add(String(UP));
        if (y > STICK) down.add(String(DOWN));
      }
      for (const id of down) {
        const n = Number(id);
        const dir: Dir | null = n === LEFT ? 'left' : n === RIGHT ? 'right' : n === UP ? 'up' : n === DOWN ? 'down' : null;
        const due = held.get(id);
        if (due === undefined) {
          press(dir ?? n);
          held.set(id, now + REPEAT_DELAY);
        } else if (dir && now >= due) {
          press(dir);
          held.set(id, now + REPEAT_EVERY);
        }
      }
      for (const id of [...held.keys()]) if (!down.has(id)) held.delete(id);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    window.addEventListener('gamepadconnected', start);
    // Schon verbunden (z. B. nach Neuladen)?
    if (navigator.getGamepads().some(Boolean)) start();
    // Maus oder Tastatur benutzt: Controller-Fokusrahmen wieder ausblenden
    const off = () => document.documentElement.classList.remove('gamepad');
    window.addEventListener('pointerdown', off);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('gamepadconnected', start);
      window.removeEventListener('pointerdown', off);
    };
  }, []);
}
