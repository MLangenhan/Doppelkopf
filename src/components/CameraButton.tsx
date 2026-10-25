import { Video, VideoOff } from 'lucide-react';
import type { CameraState } from '../lib/video';

export interface CameraControls {
  stream: MediaStream | null;
  state: CameraState;
  enabled: boolean;
  start: () => void;
  toggle: () => void;
}

const base = 'tag inline-flex items-center gap-2 text-[11px] transition-colors';

/** Schlichter Kamera-Schalter: Icon plus Mono-Label (compact = nur Icon). */
export function CameraButton({ camera, compact }: { camera: CameraControls; compact?: boolean }) {
  if (camera.state === 'denied') {
    return (
      <span className={`${base} text-red-300`} role="status">
        <VideoOff className="size-4" />
        {!compact && 'Kamera blockiert – im Browser erlauben und neu laden'}
      </span>
    );
  }
  if (camera.state === 'unavailable') {
    return (
      <button className={`${base} text-white/50 hover:text-white`} onClick={camera.start} data-cursor="Nochmal">
        <VideoOff className="size-4" />
        {!compact && 'Keine Kamera gefunden – erneut versuchen'}
      </button>
    );
  }
  const on = camera.state === 'on' && camera.enabled;
  return (
    <button
      className={`${base} ${on ? 'text-white/70 hover:text-white' : 'text-white/45 hover:text-gold-300'}`}
      onClick={camera.state === 'off' ? camera.start : camera.toggle}
      disabled={camera.state === 'starting'}
      aria-pressed={on}
      aria-label={on ? 'Kamera ausschalten' : 'Kamera einschalten'}
      data-cursor={on ? 'Kamera aus' : 'Kamera an'}
    >
      {on ? <Video className="size-4" /> : <VideoOff className="size-4" />}
      {!compact && (camera.state === 'starting' ? 'Kamera startet …' : on ? 'Kamera an' : 'Kamera aus')}
    </button>
  );
}
