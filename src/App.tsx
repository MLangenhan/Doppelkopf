import { MotionConfig } from 'motion/react';
import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { usePrefs } from './lib/prefs';
import { configureSound } from './lib/sound';
import { Cursor } from './components/Cursor';
import { ToastProvider } from './components/Toast';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { PracticePage } from './pages/PracticePage';
import { StatsPage } from './pages/StatsPage';
import { TablePage } from './pages/TablePage';

/** Überträgt die Sound-Einstellungen an die Audio-Engine */
function SoundSync() {
  const [prefs] = usePrefs();
  useEffect(() => configureSound(prefs.sound, prefs.volume), [prefs.sound, prefs.volume]);
  return null;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="grid h-full place-items-center text-white/60">
        <span className="animate-pulse">Lädt …</span>
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <SoundSync />
      <Cursor />
      <AuthProvider>
        <ToastProvider>
          {/* HashRouter, damit GitHub Pages bei Direktaufrufen keine 404 liefert */}
          <HashRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/uebung" element={<PracticePage />} />
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <HomePage />
                  </RequireAuth>
                }
              />
              <Route
                path="/t/:code"
                element={
                  <RequireAuth>
                    <TablePage />
                  </RequireAuth>
                }
              />
              <Route
                path="/statistik"
                element={
                  <RequireAuth>
                    <StatsPage />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </HashRouter>
        </ToastProvider>
      </AuthProvider>
    </MotionConfig>
  );
}
