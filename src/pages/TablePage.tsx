import { normalizeSettings, type RuleSettings } from '@engine';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Atmosphere } from '../components/Atmosphere';
import { GameView } from '../components/GameView';
import { Lobby } from '../components/Lobby';
import { useToast } from '../components/Toast';
import { TopBar } from '../components/TopBar';
import { getPrefs } from '../lib/prefs';
import { api } from '../lib/supabase';
import { useTable } from '../lib/useTable';
import { useCamera, useVideoMesh } from '../lib/video';

export function TablePage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const t = useTable(code);
  const camera = useCamera();
  const { remotes, online } = useVideoMesh(t.table?.id, t.me, camera.stream);
  const [busy, setBusy] = useState(false);
  const [lobby, setLobby] = useState(false);

  // Kamera beim Betreten des Tisches anfragen – außer man hat sie zuletzt bewusst ausgeschaltet
  useEffect(() => {
    if (t.table && getPrefs().camera) camera.start();
  }, [t.table?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const running = t.game?.status === 'running';
  // Hinweis, wenn jemand das laufende Spiel abbricht
  const gameStatus = t.game ? `${t.game.id}:${t.game.status}` : null;
  const lastStatus = useRef(gameStatus);
  useEffect(() => {
    const prev = lastStatus.current;
    lastStatus.current = gameStatus;
    if (prev && gameStatus && prev !== gameStatus && gameStatus.endsWith(':aborted')) toast('Das Spiel wurde abgebrochen', 'info');
  }, [gameStatus, toast]);
  useEffect(() => {
    if (running) setLobby(false);
  }, [running]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (t.loading) {
    return (
      <div className="flex h-full flex-col">
        <TopBar />
        <div className="grid flex-1 place-items-center text-white/60">
          <span className="animate-pulse">Tisch wird geladen …</span>
        </div>
      </div>
    );
  }

  if (t.error || !t.table) {
    return (
      <div className="flex h-full flex-col">
        <TopBar />
        <div className="grid flex-1 place-items-center px-4">
          <div className="panel max-w-md p-6 text-center">
            <p className="text-lg font-semibold">{t.error ?? 'Tisch nicht gefunden'}</p>
            <Link to="/" className="btn-primary mt-4">
              Zur Startseite
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const table = t.table;
  const aborted = t.game?.status === 'aborted';
  const showLobby = !t.game || aborted || (lobby && !running);

  return (
    <div className="flex h-full flex-col">
      <TopBar>
        <span className="tag truncate text-[11px] text-white/55">{table.name}</span>
        <span className="hidden rounded-md bg-black/30 px-2 py-0.5 tabular-nums text-xs tracking-widest text-white/60 sm:inline">
          {table.code}
        </span>
      </TopBar>
      {showLobby ? (
        <div className="felt relative isolate flex-1 overflow-y-auto">
          <Atmosphere />
          <Lobby
            table={table}
            members={t.members}
            me={t.me}
            camera={camera}
            remotes={remotes}
            online={online}
            busy={busy}
            hasPlayed={!!t.game}
            onBack={t.game && !aborted ? () => setLobby(false) : undefined}
            onStart={() => run(t.startGame)}
            onTakeSeat={(seat) => run(() => api.takeSeat(table.id, seat))}
            onSaveRules={(s: RuleSettings) =>
              run(async () => {
                await api.updateSettings(table.id, s);
                toast('Regeln gespeichert', 'success');
              })
            }
            onLeave={() =>
              run(async () => {
                await api.leaveTable(table.id);
                navigate('/');
              })
            }
          />
        </div>
      ) : (
        <GameView
          game={t.game!}
          hand={t.hand}
          members={t.members}
          results={t.results}
          finishedGames={t.finished}
          me={t.me}
          camera={camera}
          remotes={remotes}
          online={online}
          act={t.act}
          startGame={t.startGame}
          onShowLobby={() => setLobby(true)}
          onLeave={() => navigate('/')}
          onAbort={() => run(() => api.abortGame(t.game!.id))}
          rules={{
            value: normalizeSettings(table.settings),
            locked: table.host_id !== t.me ? 'Nur der Gastgeber kann die Regeln ändern' : running ? 'Änderbar, sobald das Spiel vorbei ist' : null,
            onSave: (s) =>
              run(async () => {
                await api.updateSettings(table.id, s);
                await t.refresh();
                toast('Regeln gespeichert – gelten ab dem nächsten Spiel', 'success');
              }),
          }}
        />
      )}
    </div>
  );
}
