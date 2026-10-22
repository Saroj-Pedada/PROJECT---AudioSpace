import { Link } from 'react-router';

interface LogoProps {
  to?: string;
  className?: string;
}

export default function Logo({ to = '/', className = 'text-2xl' }: LogoProps) {
  return (
    <Link to={to} className={`group inline-flex items-center gap-2.5 font-black tracking-tight ${className}`}>
      <img
        src="/images/logo.webp"
        alt=""
        width={40}
        height={40}
        className="size-[1.6em] rounded-[0.35em] shadow-lg shadow-black/40 ring-1 ring-white/15 transition group-hover:scale-105"
      />
      <span>
        Audio<span className="text-outline">Space</span>
      </span>
    </Link>
  );
}
