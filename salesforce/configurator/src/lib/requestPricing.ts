import type { VolumeTier } from '../types';

export interface PriceBand {
  fromQuantity: number;
  toQuantity: number | null;
  discountPct: number;
  unitPrice: number;
}

export interface QuantityPrice {
  band: PriceBand;
  unitPrice: number;
  total: number;
  listTotal: number;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Range tiers: the rate of the band a quantity falls into applies to every unit,
 * the same way the Salesforce volume schedule prices it. Quantities below the
 * first tier pay the list price.
 */
export function buildPriceBands(listPrice: number, tiers: VolumeTier[]): PriceBand[] {
  const sorted = [...tiers].sort((a, b) => a.fromQuantity - b.fromQuantity);
  const firstFrom = sorted[0]?.fromQuantity ?? null;
  const bands: PriceBand[] = [];

  if (firstFrom === null || firstFrom > 1) {
    bands.push({
      fromQuantity: 1,
      toQuantity: firstFrom === null ? null : firstFrom - 1,
      discountPct: 0,
      unitPrice: listPrice,
    });
  }

  for (const tier of sorted) {
    bands.push({
      fromQuantity: tier.fromQuantity,
      toQuantity: tier.toQuantity,
      discountPct: tier.discountPct,
      unitPrice: roundCents(listPrice * (1 - tier.discountPct / 100)),
    });
  }
  return bands;
}

export function priceForQuantity(bands: PriceBand[], quantity: number): QuantityPrice {
  const band =
    bands.find(
      (b) => quantity >= b.fromQuantity && (b.toQuantity === null || quantity <= b.toQuantity),
    ) ?? bands[0];
  const listPrice = bands[0].unitPrice;
  return {
    band,
    unitPrice: band.unitPrice,
    total: roundCents(band.unitPrice * quantity),
    listTotal: roundCents(listPrice * quantity),
  };
}

export function formatMoney(value: number): string {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
