import { Link } from 'react-router';
import { buttonClasses } from '../components/Button.tsx';
import MountainScene from '../components/MountainScene.tsx';

export default function NotFound() {
  return (
    <main className="relative isolate grid min-h-svh place-items-center px-4 text-center">
      <MountainScene className="-z-10" />
      <div className="-mt-[20vh]">
        <p className="text-sm font-bold tracking-[0.3em] text-white/60 uppercase">404</p>
        <h1 className="mt-3 text-4xl font-extrabold sm:text-5xl">Lost in the mountains.</h1>
        <p className="mt-3 text-white/70">This page doesn't exist, or the room has moved.</p>
        <Link to="/" className={buttonClasses('glass', 'lg', 'mt-8')}>Take me home</Link>
      </div>
    </main>
  );
}
