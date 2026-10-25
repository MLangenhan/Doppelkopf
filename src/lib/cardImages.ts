import type { Card } from '@engine';
import { spriteId } from '../components/PlayingCard';

// Einzelne Karten aus dem SVG-Sprite als Canvas rendern (z. B. für WebGL-Texturen).
// Ein <img> darf keine externen SVG-Referenzen laden, deshalb wird pro Karte ein eigenständiges
// SVG gebaut, das nur die Teile des Sprites enthält, die diese Karte wirklich braucht.

const SPRITE = `${import.meta.env.BASE_URL}cards/svg-cards.svg`;
const W = 169.075;
const H = 244.64;
const XLINK = 'http://www.w3.org/1999/xlink';

let spritePromise: Promise<Document> | null = null;

function loadSprite(): Promise<Document> {
  spritePromise ??= fetch(SPRITE)
    .then((r) => r.text())
    .then((text) => new DOMParser().parseFromString(text, 'image/svg+xml'));
  return spritePromise;
}

function refsOf(el: Element): string[] {
  const out: string[] = [];
  const nodes = [el, ...Array.from(el.querySelectorAll('use'))];
  for (const n of nodes) {
    const href = n.getAttribute('href') ?? n.getAttributeNS(XLINK, 'href');
    if (href?.startsWith('#')) out.push(href.slice(1));
  }
  return out;
}

/** Eigenständiges SVG für ein Sprite-Element samt allen referenzierten Teilen. */
function standaloneSvg(doc: Document, id: string, fill?: string): string {
  const needed = new Set<string>();
  const queue = [id];
  while (queue.length) {
    const next = queue.pop()!;
    if (needed.has(next)) continue;
    const el = doc.getElementById(next);
    if (!el) continue;
    needed.add(next);
    queue.push(...refsOf(el));
  }
  const ser = new XMLSerializer();
  const defs = [...needed].map((n) => ser.serializeToString(doc.getElementById(n)!)).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="${XLINK}" viewBox="0 0 ${W} ${H}" width="${W * 4}" height="${H * 4}">` +
    `<defs>${defs}</defs><use xlink:href="#${id}"${fill ? ` fill="${fill}"` : ''}/></svg>`
  );
}

function loadImage(svg: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/** Karte (oder Rückseite bei `card = null`) als Canvas mit abgerundeten Ecken. */
export async function renderCardCanvas(card: Card | null, width = 512): Promise<HTMLCanvasElement> {
  const doc = await loadSprite();
  const img = await loadImage(standaloneSvg(doc, card ? spriteId(card) : 'back', card ? undefined : '#1d4f8f'));
  const height = Math.round((width * H) / W);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const r = width * 0.06;
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, r);
  ctx.clip();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}
