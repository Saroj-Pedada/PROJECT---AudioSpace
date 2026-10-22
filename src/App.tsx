import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { useAuth } from './lib/auth.tsx';
import Spinner from './components/Spinner.tsx';
import Landing from './pages/Landing.tsx';
import Lobby from './pages/Lobby.tsx';
import Room from './pages/Room.tsx';
import NotFound from './pages/NotFound.tsx';

function FullPageSpinner() {
  return (
    <div className="grid min-h-svh place-items-center">
      <Spinner className="size-8" />
    </div>
  );
}

function RequireUser({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === undefined) return <FullPageSpinner />;
  if (!user) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  return children;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === undefined) return <FullPageSpinner />;
  // After signing in, return to the room link that sent them here, if any.
  if (user) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/rooms'} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<GuestOnly><Landing /></GuestOnly>} />
      <Route path="/rooms" element={<RequireUser><Lobby /></RequireUser>} />
      <Route path="/rooms/:roomId" element={<RequireUser><Room /></RequireUser>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
