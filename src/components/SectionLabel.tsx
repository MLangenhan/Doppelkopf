import type { ReactNode } from 'react';

/** Nummeriertes Abschnitts-Label in Mono, z. B. „01 / Neuer Tisch“, optional mit Aktion rechts. */
export function SectionLabel({ n, children, action }: { n: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-baseline justify-between gap-4">
      <h2 className="tag flex items-baseline gap-2.5 text-[11px] text-white/45">
        <span className="text-gold-400">{n}</span>
        <span aria-hidden>/</span>
        <span className="text-white/80">{children}</span>
      </h2>
      {action}
    </div>
  );
}

/** Dezenter Mono-Link mit Pfeil */
export const arrowLink = 'tag text-[11px] text-gold-300 transition-colors hover:text-gold-400';
