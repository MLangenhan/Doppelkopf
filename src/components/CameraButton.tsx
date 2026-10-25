import type { CameraState } from '../lib/video';

export interface CameraControls {
  stream: MediaStream | null;
  state: CameraState;
  enabled: boolean;
  start: () => void;
  toggle: () => void;
}

export function CameraButton({ camera, compact }: { camera: CameraControls; compact?: boolean }) {
  if (camera.state === 'denied') {
    return (
      <span className="rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200" role="status">
        Kamera blockiert – im Browser (Schloss-Symbol in der Adressleiste) erlauben und neu laden.
      </span>
    );
  }
  if (camera.state === 'unavailable') {
    return (
      <button className="btn-secondary" onClick={camera.start}>
        Keine Kamera gefunden – erneut versuchen
      </button>
    );
  }
  if (camera.state === 'off') {
    return (
      <button className={`btn-secondary ${compact ? 'px-3 py-2' : ''}`} onClick={camera.start}>
        Kamera einschalten
      </button>
    );
  }
  const on = camera.enabled;
  return (
    <button
      className={`btn ${on ? 'border border-white/15 bg-white/10 hover:bg-white/15' : 'bg-red-500/80 hover:bg-red-500'} ${compact ? 'px-3 py-2' : ''}`}
      onClick={camera.toggle}
      disabled={camera.state === 'starting'}
      aria-pressed={on}
      title={on ? 'Kamera ausschalten' : 'Kamera einschalten'}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M15 10l4.55-2.28A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.9L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        {!on && <path d="M3 3l18 18" />}
      </svg>
      {!compact && (camera.state === 'starting' ? 'Kamera startet …' : on ? 'Kamera an' : 'Kamera aus')}
    </button>
  );
}
