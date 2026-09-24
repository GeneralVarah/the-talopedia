/**
 * What the date is inside Avium.
 *
 * Time runs faster there, at a rate that has been changed five times, so the map from
 * a real date to an in-universe one is piecewise linear. The table below is the one
 * the Avium Time Counter keeps; if an epoch is added there, add it here too.
 *
 * The site rebuilds itself every night for the featured article, so anything derived
 * from this is never more than a day behind.
 */
const EPOCHS = [
  { ooc: '2026-06-28T00:00:00Z', ic: '1931-06-01', daysPerYear: 52 },
  { ooc: '2026-07-05T00:00:00Z', ic: '1931-12-24', daysPerYear: 26 },
  { ooc: '2026-07-20T00:00:00Z', ic: '1933-01-01', daysPerYear: 26 },
  { ooc: '2026-07-27T00:00:00Z', ic: '1933-04-08', daysPerYear: 52 },
  { ooc: '2026-08-08T00:00:00Z', ic: '1934-01-01', daysPerYear: 52 },
];

const DAY = 86400000;
const YEAR = 365.2425 * DAY;

/** The in-universe instant for a real one. */
export function icNow(at = new Date()) {
  const t = at.getTime();
  let ep = EPOCHS[0];
  for (let i = EPOCHS.length - 1; i >= 0; i--) {
    if (t >= Date.parse(EPOCHS[i].ooc)) { ep = EPOCHS[i]; break; }
  }
  const rate = YEAR / (ep.daysPerYear * DAY);
  return new Date(Date.parse(ep.ic) + (t - Date.parse(ep.ooc)) * rate);
}

const LONG = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });

/** "June 6, 1896", the one date format the manual allows. */
export const longDate = (iso) => LONG.format(new Date(iso));

/** Whole years between two dates, the way an age is counted. */
export function yearsBetween(fromIso, toDate) {
  const [y, m, d] = fromIso.split('-').map(Number);
  let n = toDate.getUTCFullYear() - y;
  const before = toDate.getUTCMonth() + 1 < m
    || (toDate.getUTCMonth() + 1 === m && toDate.getUTCDate() < d);
  if (before) n -= 1;
  return n;
}
