import { normalizeSettings, type RuleSettings } from '@engine';
import { ArrowRight, Check, Copy } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import type { Member, TableRow } from '../lib/supabase';
import type { RemoteVideo } from '../lib/video';
import { CameraButton, type CameraControls } from './CameraButton';
import { RulesForm, rulesSummary } from './RulesForm';
import { arrowLink, SectionLabel } from './SectionLabel';
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

  const status =
    count < 4
      ? `Noch ${4 - count} Spieler ${4 - count === 1 ? 'fehlt' : 'fehlen'}`
      : count === 4
        ? 'Alle da – es kann losgehen'
        : 'Zu fünft – der Geber setzt jeweils aus';

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-4 pb-16">
      {/* Kopf: Name, Status, Einladung */}
      <header className="flex flex-wrap items-end justify-between gap-6 pb-8">
        <div>
          <p className="tag text-[11px] text-white/45">
            <span className="text-gold-400">Lobby</span> / {status}
          </p>
          <h1 className="display mt-2 text-6xl sm:text-7xl">{table.name}</h1>
        </div>
        <button
          onClick={copy}
          className="group flex items-center gap-4 text-left"
          data-cursor={copied ? 'Kopiert' : 'Kopieren'}
          aria-label="Einladungslink kopieren"
        >
          <span>
            <span className="tag block text-[10px] text-white/40">Einladen</span>
            <span className="tag block text-3xl tracking-[0.25em] text-white">{table.code}</span>
          </span>
          <span className="grid size-10 place-items-center rounded-full border border-white/15 text-white/70 transition-colors group-hover:border-gold-400 group-hover:text-gold-300">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </span>
        </button>
      </header>

      {/* Plätze */}
      <section className="border-t border-white/[0.08] py-8">
        <SectionLabel n="01">Plätze · im Uhrzeigersinn</SectionLabel>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((seat) => {
            const m = members.find((x) => x.user_id && x.seat === seat);
            const isMe = m?.user_id === me;
            const isOnline = !!m && (isMe || online.includes(m.user_id));
            return (
              <motion.div key={seat} layout className="flex flex-col gap-2">
                <AnimatePresence mode="wait">
                  {m ? (
                    <motion.div key={m.user_id} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}>
                      <VideoTile
                        stream={isMe ? camera.stream : remotes[m.user_id]?.stream}
                        videoOff={isMe && !camera.enabled}
                        name={m.display_name}
                        mirror={isMe}
                        connecting={!isMe && online.includes(m.user_id) && remotes[m.user_id]?.status === 'connecting'}
                        className="aspect-[4/3] w-full"
                      >
                        <div className="absolute bottom-2 left-2 flex max-w-[85%] items-center gap-2 rounded-md bg-felt-950/75 px-2 py-1">
                          <span className={`size-1.5 shrink-0 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-white/30'}`} />
                          <span className="truncate text-sm font-medium">{isMe ? `${m.display_name} (du)` : m.display_name}</span>
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
                      data-cursor="Setzen"
                      className="group relative grid aspect-[4/3] w-full place-items-center rounded-xl border border-dashed border-white/15 transition-colors hover:border-gold-400/60"
                    >
                      <span className="tag text-[10px] text-white/35 transition-colors group-hover:text-gold-300">
                        <span className="group-hover:hidden">Frei</span>
                        <span className="hidden group-hover:inline">Hierher setzen</span>
                      </span>
                    </motion.button>
                  )}
                </AnimatePresence>
                <span className="tag flex gap-2 text-[10px] text-white/35">
                  <span>{String(seat + 1).padStart(2, '0')}</span>
                  {m && table.host_id === m.user_id && <span className="text-gold-400/80">Gastgeber</span>}
                </span>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <button className="btn-primary px-8 py-3 text-base" disabled={busy || count < 4 || count > 5} onClick={onStart}>
            {hasPlayed ? 'Weiterspielen' : 'Spiel starten'} <ArrowRight className="size-4" />
          </button>
          {onBack && (
            <button className={arrowLink} onClick={onBack}>
              Zurück zum Tisch
            </button>
          )}
          <CameraButton camera={camera} />
          <span className="flex-1" />
          <button className="tag text-[11px] text-white/40 transition-colors hover:text-red-300" onClick={onLeave} disabled={busy}>
            Tisch verlassen
          </button>
        </div>
      </section>

      {/* Regeln */}
      <section className="border-t border-white/[0.08] py-8">
        <SectionLabel
          n="02"
          action={
            isHost && !editing ? (
              <button className={arrowLink} onClick={() => setEditing(true)}>
                Bearbeiten
              </button>
            ) : undefined
          }
        >
          Hausregeln
        </SectionLabel>
        {editing ? (
          <div>
            <RulesForm value={draft} onChange={setDraft} />
            <div className="mt-6 flex justify-end gap-3">
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
          <p className="max-w-3xl text-white/70">
            {rulesSummary(settings).map((s, i) => (
              <span key={s} className="whitespace-nowrap">
                {i > 0 && <span className="px-2 text-white/25">/</span>}
                {s}
              </span>
            ))}
          </p>
        )}
        {!isHost && <p className="tag mt-3 text-[10px] text-white/35">Nur der Gastgeber kann die Regeln ändern</p>}
      </section>
    </div>
  );
}
