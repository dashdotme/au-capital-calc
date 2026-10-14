import { useEffect, useRef, useState, type ReactNode } from 'react';

interface SentencePillProps {
  label: string;
  /** Heading for the editor, also its accessible name */
  title: string;
  children: (close: () => void) => ReactNode;
}

/** An underlined value inside the sentence that opens a small editor. */
export default function SentencePill({ label, title, children }: SentencePillProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <span ref={wrapperRef} className="relative inline">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
        className="sentence-pill"
      >
        {label}
      </button>
      {open && (
        <span
          role="dialog"
          aria-label={title}
          className="fixed inset-x-0 bottom-0 z-40 block rounded-t-2xl border border-line-strong bg-surface px-5 pt-5 pb-8 text-left text-base leading-normal font-normal tracking-normal text-ink shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-3 sm:w-80 sm:rounded-xl sm:pb-5"
        >
          <span className="mb-3 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">{title}</span>
            <button type="button" onClick={close} className="min-h-8 rounded-md px-2 text-sm text-ink-2 hover:text-ink">
              Done
            </button>
          </span>
          {children(close)}
        </span>
      )}
    </span>
  );
}
