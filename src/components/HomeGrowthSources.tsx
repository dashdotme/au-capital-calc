import SourcesModal, { type Source } from './SourcesModal';

const SOURCES: Source[] = [
  {
    title: 'Long-run trends in housing price growth',
    publisher: 'Reserve Bank of Australia, Bulletin, September 2015',
    detail: 'About 7¼% a year in the 30 years to 2015, mostly from lower inflation and interest rates and easier credit, not income growth.',
    url: 'https://www.rba.gov.au/publications/bulletin/2015/sep/3.html',
  },
  {
    title: 'How much have house prices grown in the past 30 years?',
    publisher: 'Investor Daily, citing CoreLogic (about 2022)',
    detail: 'Combined capitals about 5.6% a year over 30 years: Melbourne 5.9%, Sydney 5.8%, Adelaide 5.2%, Brisbane 5.1%, Perth 4.8%.',
    url: 'https://www.investordaily.com.au/news/51953-how-much-have-house-prices-grown-in-the-past-30-years',
  },
  {
    title: 'Australia’s housing affordability hits new lows',
    publisher: 'Cotality, November 2025',
    detail: 'Dwelling values are a record 8.2 times household income, against a 20-year average of 6.8.',
    url: 'https://www.cotality.com/au/insights/articles/australias-housing-affordability-hits-new-lows',
  },
  {
    title: 'Westpac tips November hike as home price forecasts worsen',
    publisher: 'Broker News, October 2026',
    detail: 'Westpac expects prices to fall about 8% in 2026 and rise 3% in 2027. Bank forecasts have swung sharply this year.',
    url: 'https://www.brokernews.com.au/news/breaking-news/westpac-tips-november-hike-as-home-price-forecasts-worsen-290149.aspx',
  },
  {
    title: 'How much further will house prices fall, according to AMP’s chief economist',
    publisher: 'The Motley Fool, October 2026',
    detail: 'AMP expects a 10–15% fall from the peak, bottoming around mid-2027.',
    url: 'https://www.fool.com.au/2026/10/01/how-much-further-will-house-prices-fall-according-to-amps-chief-economist/',
  },
  {
    title: 'Residential property market outlook',
    publisher: 'KPMG, August 2026',
    detail: 'Houses −1.1% in 2026 and +3.4% in 2027; units +2.2% and +3.7%.',
    url: 'https://kpmg.com/au/en/media/media-releases/2026/08/rising-rates-and-growing-uncertainty-continues-to-cool-housing-market.html',
  },
];

/** "Why?" link that opens the reasoning and sources behind the default home price growth rates. */
export default function HomeGrowthSources({ label = 'Why these rates?' }: { label?: string }) {
  return (
    <SourcesModal label={label} title="Why 2.5%, 4% and 5% a year" sources={SOURCES}>
      <p>
        These are long-run averages over decades, before inflation is taken out, not a forecast for next year. Prices are
        falling in 2026 after rate rises, but over 30 years one bad year matters much less than the trend.
      </p>
      <p>
        Over the last 30 years capital city prices grew 5–6% a year, but much of that came from a one-off fall in interest
        rates and a big rise in how much households could borrow. That can’t happen again, and prices are already a record
        8.2 times income. Incomes grow about 3–3.5% a year, so prices growing with incomes gives about 3.5%; a little extra for
        scarce land and population growth gives 4%.
      </p>
      <p>
        <strong className="font-semibold text-ink">2.5%</strong> means prices only keep up with inflation, roughly what
        happens if they drift back toward their usual multiple of income. <strong className="font-semibold text-ink">5%</strong>{' '}
        matches the 30-year record without the rate-fall years; anything higher for 30 years would push prices to around 14
        times income. Units have grown about 1 point a year slower than houses.
      </p>
    </SourcesModal>
  );
}
