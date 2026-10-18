import { useRef } from 'react';
import { NEW_HOME_DRAG_YEARS, NEW_HOME_GROWTH_DRAG } from '../utils/calculations';

const SOURCES = [
  {
    title: 'Why new builds tend to cost about 6% more than established homes',
    publisher: 'Loan Market NZ, citing CoreLogic',
    detail: 'The new-build premium averages about 6% and has ranged from −2% to 15% since 2002 (New Zealand data).',
    url: 'https://adviser.loanmarket.co.nz/agile/blog/why-new-builds-tend-to-cost-about-6-more-than-established-homes',
  },
  {
    title: 'CoreLogic says developers and builders may not be able to keep charging a price premium',
    publisher: 'interest.co.nz',
    detail: 'CoreLogic on how the new-build premium moves with the market.',
    url: 'https://interest.co.nz/property/127034/corelogic-says-developers-and-builders-may-not-be-able-keep-charging-price-premium',
  },
  {
    title: 'Tax perks aren’t everything: established homes could deliver nearly $600k more',
    publisher: 'Smart Property Investment, 2026',
    detail: 'Industry modelling puts established-home growth at 6–8% a year against 3–5% for new builds. The source has a commercial interest, and a gap that size held for decades looks too harsh.',
    url: 'https://www.smartpropertyinvestment.com.au/investor-strategy/27970-tax-perks-arent-everything-established-homes-could-deliver-nearly-600k-more',
  },
  {
    title: 'New homes in large, purpose-built estates don’t provide above average long-term capital growth',
    publisher: 'Michael Yardney, apartments.com.au',
    detail: 'Opinion: new homes usually cost more than comparable established ones, and land, not the building, drives long-term growth.',
    url: 'https://www.apartments.com.au/expert-insights/investing/new-homes-in-large-purpose-built-estates-don-t-provide-above-average-long-term-capital-growth-michael-yardney',
  },
];

/** "Why?" link that opens the reasoning and sources behind the new-home growth adjustment. */
export default function NewHomeGrowthSources({ label = 'Why?' }: { label?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button type="button" onClick={() => dialogRef.current?.showModal()} className="underline hover:text-ink">
        {label}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="new-home-growth-title"
        // Keep Escape from also closing a drawer this sits in
        onKeyDown={(e) => e.key === 'Escape' && e.stopPropagation()}
        onClick={(e) => e.target === e.currentTarget && dialogRef.current?.close()}
        className="m-auto w-[calc(100%-32px)] max-w-xl rounded-2xl border border-line bg-ground p-0 text-ink shadow-2xl backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id="new-home-growth-title" className="m-0 text-lg font-semibold">Why new homes grow slower here</h2>
            <button type="button" onClick={() => dialogRef.current?.close()}
              className="min-h-9 shrink-0 rounded-lg border border-line px-3 text-sm text-ink-2 hover:text-ink">
              Close
            </button>
          </div>
          <p className="m-0 text-sm leading-relaxed text-ink-2">
            A new home usually sells at a premium over a comparable established one, and more of its price is a building
            that wears out rather than land that appreciates. So its value tends to lag at first. The calculator takes{' '}
            {NEW_HOME_GROWTH_DRAG} point a year off your growth rate for the first {NEW_HOME_DRAG_YEARS} years, then uses
            the full rate, by which point the home is roughly 10% below an established one bought at the same price.
          </p>
          <p className="m-0 text-sm leading-relaxed text-ink-2">
            There’s no rigorous Australian estimate, so this is a judgment call between the measured new-build premium
            and industry claims of a much larger, permanent gap. Lower the growth rate further for apartments in large
            new developments.
          </p>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {SOURCES.map((s) => (
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
