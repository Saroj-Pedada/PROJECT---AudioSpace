import { LoaderCircle } from 'lucide-react';

export default function Spinner({ className = 'size-5' }: { className?: string }) {
  return <LoaderCircle aria-label="Loading" className={`animate-spin text-white/70 ${className}`} />;
}
