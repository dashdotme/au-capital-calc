import { useRef, type ReactNode } from 'react';

export interface Source {
  title: string;
  publisher: string;
  detail: string;
  url: string;
}

/** A link that opens a dialog explaining an assumption, with the sources behind it. */
export default function SourcesModal({ label, title, sources, children }: {
  label: string;
  title: string;
  sources: Source[];
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = `sources-${title.replace(/\W+/g, '-').toLowerCase()}`;

  return (
    <>
      <button type="button" onClick={() => dialogRef.current?.showModal()} className="underline hover:text-ink">
        {label}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        // Keep Escape from also closing a drawer this sits in
        onKeyDown={(e) => e.key === 'Escape' && e.stopPropagation()}
        onClick={(e) => e.target === e.currentTarget && dialogRef.current?.close()}
        className="m-auto w-[calc(100%-32px)] max-w-xl rounded-2xl border border-line bg-ground p-0 text-ink shadow-2xl backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="m-0 text-lg font-semibold">{title}</h2>
            <button type="button" onClick={() => dialogRef.current?.close()}
              className="min-h-9 shrink-0 rounded-lg border border-line px-3 text-sm text-ink-2 hover:text-ink">
              Close
            </button>
          </div>
          <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-2 [&_p]:m-0">{children}</div>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {sources.map((s) => (
              <li key={s.url} className="flex flex-col gap-0.5 border-t border-line pt-3">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline hover:text-ink-2">
                  {s.title}
                </a>
                <span className="text-xs text-muted">{s.publisher}</span>
                <span className="text-xs leading-snug text-ink-2">{s.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  );
}
