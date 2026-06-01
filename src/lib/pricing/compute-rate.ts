/**
 * Pure rate computation. Given a set of vehicle rate cards and a
 * pickup/return window, pick the cheapest applicable unit.
 *
 * Hourly is preferred for short windows; daily/weekly/monthly are
 * compared once the duration crosses each threshold. Package rates win
 * outright if the rental fits inside the package_hours window and the
 * package price is lower than the next-cheapest unit-rate alternative.
 */

export type RateKind = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'package';

export interface Rate {
  rateKind: RateKind;
  priceAed: number;
  packageHours?: number | null;
  packageName?: string | null;
}

export interface RatePick {
  unit: RateKind;
  quantity: number;
  priceAed: number;
  totalAed: number;
  packageName?: string | null;
}

export function durationHours(pickupAt: Date, returnAt: Date): number {
  const ms = returnAt.getTime() - pickupAt.getTime();
  return Math.max(0, ms / 3_600_000);
}

export function computeBestRate(
  rates: Rate[],
  pickupAt: Date,
  returnAt: Date,
): RatePick | null {
  const hoursExact = durationHours(pickupAt, returnAt);
  if (hoursExact <= 0) return null;

  const hours = Math.ceil(hoursExact);
  const days = Math.ceil(hours / 24);
  const weeks = Math.ceil(days / 7);
  const months = Math.ceil(days / 30);

  const candidates: RatePick[] = [];
  for (const r of rates) {
    if (r.rateKind === 'hourly') {
      candidates.push({
        unit: 'hourly',
        quantity: hours,
        priceAed: r.priceAed,
        totalAed: hours * r.priceAed,
      });
    } else if (r.rateKind === 'daily') {
      candidates.push({
        unit: 'daily',
        quantity: days,
        priceAed: r.priceAed,
        totalAed: days * r.priceAed,
      });
    } else if (r.rateKind === 'weekly' && weeks > 0) {
      candidates.push({
        unit: 'weekly',
        quantity: weeks,
        priceAed: r.priceAed,
        totalAed: weeks * r.priceAed,
      });
    } else if (r.rateKind === 'monthly' && months > 0) {
      candidates.push({
        unit: 'monthly',
        quantity: months,
        priceAed: r.priceAed,
        totalAed: months * r.priceAed,
      });
    } else if (r.rateKind === 'package' && r.packageHours && hours <= r.packageHours) {
      candidates.push({
        unit: 'package',
        quantity: 1,
        priceAed: r.priceAed,
        totalAed: r.priceAed,
        packageName: r.packageName ?? null,
      });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.totalAed - b.totalAed);
  return candidates[0] ?? null;
}
