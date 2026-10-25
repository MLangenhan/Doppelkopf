import { MotionConfig } from 'motion/react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider } from './components/Toast';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { PracticePage } from './pages/PracticePage';
import { StatsPage } from './pages/StatsPage';
import { TablePage } from './pages/TablePage';

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
