import type { CommissionType } from './roles';

export const baht = (n: number, decimals = true) =>
  `฿${n.toLocaleString('th-TH', {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  })}`;

type PricedService = { price: number; minutes: number; commissionType: CommissionType; commissionValue: number };

/** Base price scaled by the chosen duration. Add-ons (minutes = 0) are flat-priced. */
export const linePrice = (s: Pick<PricedService, 'price' | 'minutes'>, minutes: number) =>
  s.minutes === 0 ? s.price : Math.round((s.price * minutes) / s.minutes);

export const lineCommission = (s: PricedService, minutes: number) =>
  s.commissionType === 'PERCENT'
    ? Math.round((linePrice(s, minutes) * s.commissionValue) / 100)
    : s.minutes === 0
      ? s.commissionValue
      : Math.round((s.commissionValue * minutes) / s.minutes);
