import { DISCLAIMER, SOURCE_URL } from '../site';

export default function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6">
        <p className="m-0 max-w-3xl text-[13px] leading-relaxed font-medium text-ink-2">
          {DISCLAIMER} You can view the source code{' '}
          <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ink">here</a>.
        </p>
      </div>
    </footer>
  );
}
