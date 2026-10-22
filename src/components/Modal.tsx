import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  width?: string;
}

/** A native <dialog> with the app's glass styling; closes on Escape, backdrop click or the X. */
export default function Modal({ open, onClose, title, subtitle, children, width = 'w-[min(440px,calc(100vw-2rem))]' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={e => e.target === ref.current && onClose()}
      className={`m-auto ${width} overflow-visible bg-transparent p-0 text-white backdrop:bg-night-950/70 backdrop:backdrop-blur-sm open:animate-rise`}
    >
      {open && (
        <div className="glass relative max-h-[calc(100svh-2rem)] overflow-y-auto rounded-3xl bg-night-800/90 p-7 sm:p-9">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 grid size-9 cursor-pointer place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
          <h2 className="pr-8 text-2xl font-extrabold sm:text-3xl">{title}</h2>
          {subtitle && <p className="mt-1.5 text-sm text-white/60">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      )}
    </dialog>
  );
}
