import { useEffect, useRef, useState } from 'react';
import { PAGE_SLUGS, type Page } from '../utils/shareState';

const ITEMS: { page: Page; detail: string }[] = [
  { page: 'buy', detail: 'Buy a home, or rent and invest the difference' },
  { page: 'invest', detail: 'An investment property, or a share fund' },
  { page: 'learn', detail: 'How house prices work over decades' },
];

/** The page title, which opens a menu of the site's calculators. */
export default function PageMenu({ page, titles, onSelect }: { page: Page; titles: Record<Page, string>; onSelect: (page: Page) => void }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
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

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="-ml-2 flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-lg font-bold tracking-tight hover:bg-raised sm:text-xl"
      >
        {titles[page]}
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden className={`text-ink-2 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div role="menu" aria-label="Calculators"
          className="absolute top-full left-0 z-40 mt-2 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-0.5 rounded-xl border border-line-strong bg-surface p-1.5 shadow-2xl">
          {ITEMS.map(({ page: item, detail }) => (
            <a
              key={item}
              role="menuitem"
              href={`#${PAGE_SLUGS[item]}`}
              aria-current={item === page ? 'page' : undefined}
              onClick={(e) => {
                // A plain click switches in place and keeps your inputs; modified clicks open a new tab
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                setOpen(false);
                onSelect(item);
              }}
              className={`flex flex-col gap-0.5 rounded-lg px-3 py-2.5 text-ink no-underline ${item === page ? 'bg-raised' : 'hover:bg-raised'} ${item === 'learn' ? 'mt-1 border-t border-line pt-3' : ''}`}
            >
              <span className="text-[15px] font-semibold">{titles[item]}</span>
              <span className="text-[13px] text-muted">{detail}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
