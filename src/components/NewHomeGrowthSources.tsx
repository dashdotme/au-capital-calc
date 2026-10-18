import SourcesModal, { type Source } from './SourcesModal';
import { NEW_HOME_DRAG_YEARS, NEW_HOME_GROWTH_DRAG } from '../utils/calculations';

const SOURCES: Source[] = [
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
  return (
    <SourcesModal label={label} title="Why new homes grow slower here" sources={SOURCES}>
      <p>
        A new home usually sells at a premium over a comparable established one, and more of its price is a building
        that wears out rather than land that appreciates. So its value tends to lag at first. The calculator takes{' '}
        {NEW_HOME_GROWTH_DRAG} point a year off your growth rate for the first {NEW_HOME_DRAG_YEARS} years, then uses
        the full rate, by which point the home is roughly 10% below an established one bought at the same price.
      </p>
      <p>
        There’s no rigorous Australian estimate, so this is a judgment call between the measured new-build premium
        and industry claims of a much larger, permanent gap. Lower the growth rate further for apartments in large
        new developments.
      </p>
    </SourcesModal>
  );
}
