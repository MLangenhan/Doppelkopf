import { normalizeSettings, type RuleSettings } from '@engine';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import type { Member, TableRow } from '../lib/supabase';
import type { RemoteVideo } from '../lib/video';
import { CameraButton, type CameraControls } from './CameraButton';
import { RulesForm, rulesSummary } from './RulesForm';
import { VideoTile } from './VideoTile';

export function Lobby({
  table,
  members,
  me,
  camera,
  remotes,
  online,
  onStart,
  onTakeSeat,
  onSaveRules,
  onLeave,
  onBack,
  busy,
  hasPlayed,
}: {
  table: TableRow;
  members: Member[];
  me: string | null;
  camera: CameraControls;
  remotes: Record<string, RemoteVideo>;
  online: string[];
  onStart: () => void;
  onTakeSeat: (seat: number) => void;
  onSaveRules: (s: RuleSettings) => Promise<void>;
  onLeave: () => void;
  /** Zurück zum laufenden Abend (wenn schon gespielt wurde) */
  onBack?: () => void;
  busy: boolean;
  hasPlayed: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RuleSettings>(() => normalizeSettings(table.settings));
  const isHost = table.host_id === me;
  const settings = normalizeSettings(table.settings);
  const link = `${window.location.origin}${window.location.pathname}#/t/${table.code}`;
  const count = members.length;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Link kopieren:', link);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">{table.name}</h1>
          <p className="mt-1 text-white/65">
            {count < 4
              ? `Noch ${4 - count} Spieler ${4 - count === 1 ? 'fehlt' : 'fehlen'} – teile den Link!`
              : count === 4
                ? 'Alle da – es kann losgehen.'
                : 'Zu fünft: Der Geber setzt jeweils eine Runde aus.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-xl bg-black/30 px-3 py-2 font-mono text-lg tracking-[0.25em]" aria-label="Tisch-Code">
            {table.code}
          </span>
          <button className="btn-secondary" onClick={copy}>
            {copied ? '✓ Kopiert' : 'Einladungslink kopieren'}
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((seat) => {
          const m = members.find((x) => x.user_id && x.seat === seat);
          const isMe = m?.user_id === me;
          return (
            <motion.div key={seat} layout className="flex flex-col gap-2">
              <AnimatePresence mode="wait">
                {m ? (
                  <motion.div key={m.user_id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                    <VideoTile
                      stream={isMe ? camera.stream : remotes[m.user_id]?.stream}
                      videoOff={isMe && !camera.enabled}
                      name={m.display_name}
                      mirror={isMe}
                      connecting={!isMe && online.includes(m.user_id) && remotes[m.user_id]?.status === 'connecting'}
                      className="aspect-[4/3] w-full"
                    >
                      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/75 to-transparent px-2.5 pt-6 pb-2">
                        <span
                          className={`h-2 w-2 rounded-full ${isMe || online.includes(m.user_id) ? 'bg-emerald-400' : 'bg-white/30'}`}
                          title={isMe || online.includes(m.user_id) ? 'Online' : 'Nicht verbunden'}
                        />
                        <span className="truncate text-sm font-semibold">{isMe ? `${m.display_name} (du)` : m.display_name}</span>
                        {table.host_id === m.user_id && <span className="ml-auto text-xs" title="Gastgeber">👑</span>}
                      </div>
                    </VideoTile>
                  </motion.div>
                ) : (
                  <motion.button
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => onTakeSeat(seat)}
                    disabled={busy}
                    className="grid aspect-[4/3] w-full place-items-center rounded-2xl border-2 border-dashed border-white/15 text-sm text-white/45 transition hover:border-gold-400/60 hover:text-gold-300"
                  >
                    <span>
                      Platz {seat + 1} frei
                      <span className="block text-xs">Hierher setzen</span>
                    </span>
                  </motion.button>
                )}
              </AnimatePresence>
              <span className="text-center text-xs text-white/40">Platz {seat + 1}</span>
            </motion.div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-white/45">Gespielt wird im Uhrzeigersinn nach Platznummer.</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button className="btn-primary px-8 py-3 text-base" disabled={busy || count < 4 || count > 5} onClick={onStart}>
          {hasPlayed ? 'Weiterspielen' : 'Spiel starten'}
        </button>
        {onBack && (
          <button className="btn-secondary" onClick={onBack}>
            Zurück zum Tisch
          </button>
        )}
        <CameraButton camera={camera} />
        <span className="flex-1" />
        <button className="btn-ghost text-white/60" onClick={onLeave} disabled={busy}>
          Tisch verlassen
        </button>
      </div>

      <section className="panel mt-8 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Hausregeln</h2>
          {isHost && !editing && (
            <button className="btn-ghost px-3 py-1.5 text-gold-300" onClick={() => setEditing(true)}>
              Bearbeiten
            </button>
          )}
        </div>
        {editing ? (
          <div className="mt-4">
            <RulesForm value={draft} onChange={setDraft} />
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="btn-ghost"
                onClick={() => {
                  setDraft(settings);
                  setEditing(false);
                }}
              >
                Abbrechen
              </button>
              <button
                className="btn-primary"
                disabled={busy}
                onClick={async () => {
                  await onSaveRules(draft);
                  setEditing(false);
                }}
              >
                Speichern
              </button>
            </div>
          </div>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {rulesSummary(settings).map((s) => (
              <li key={s} className="rounded-lg bg-white/10 px-2.5 py-1 text-sm text-white/80">
                {s}
              </li>
            ))}
          </ul>
        )}
        {!isHost && <p className="mt-3 text-xs text-white/45">Nur der Gastgeber kann die Regeln ändern.</p>}
      </section>
    </div>
  );
}
