import { DISCLAIMER } from '../site';

export default function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6">
        <p className="m-0 max-w-3xl text-[13px] leading-relaxed font-medium text-ink-2">{DISCLAIMER}</p>
      </div>
    </footer>
  );
}
