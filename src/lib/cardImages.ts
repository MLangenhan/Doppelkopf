import type { Card } from '@engine';
import { CARD_RATIO, cardUrl } from '../components/PlayingCard';

// Einzelne Karten als Canvas rendern (z. B. für WebGL-Texturen in der 3D-Szene).

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Karte (oder Rückseite bei `card = null`) als Canvas mit abgerundeten Ecken. */
export async function renderCardCanvas(card: Card | null, width = 512): Promise<HTMLCanvasElement> {
  const img = await loadImage(cardUrl(card));
  const height = Math.round(width * CARD_RATIO);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, width * 0.05);
  ctx.clip();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}
