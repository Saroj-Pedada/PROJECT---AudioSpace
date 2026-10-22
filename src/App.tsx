import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { useAuth } from './lib/auth.tsx';
import Spinner from './components/Spinner.tsx';
import Landing from './pages/Landing.tsx';
import Lobby from './pages/Lobby.tsx';
import Room from './pages/Room.tsx';
import Profile from './pages/Profile.tsx';
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
  // Send them home to sign in, remembering where they were headed.
  if (!user) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      {/* The landing page is open to everyone, signed in or not. */}
      <Route path="/" element={user === undefined ? <FullPageSpinner /> : <Landing />} />
      <Route path="/rooms" element={<RequireUser><Lobby /></RequireUser>} />
      <Route path="/rooms/:roomId" element={<RequireUser><Room /></RequireUser>} />
      <Route path="/profile" element={<RequireUser><Profile /></RequireUser>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
