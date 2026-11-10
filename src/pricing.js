/*
 * Quote preview, computed from GET catalog before anything is written, so the
 * rep sees the number on the card. Pure. Revenue Cloud prices the real quote;
 * the card says so when its grandTotal differs.
 *
 * Rules (salesforce/skills/sales-copilot-sell/SKILL.md):
 *  - a volume tier is reached by the quantity on that line and applies to every
 *    unit on it; existing assets do not count;
 *  - the manual discount is taken off the price after the tier;
 *  - a bundle costs its required components plus the chosen optional ones;
 *  - above maxDiscountWithoutApprovalPct the quote needs a manager.
 */

const cents = (n) => Math.round(n * 100) / 100;

function tierFor(tiers = [], qty) {
  return tiers
    .filter((t) => t.adjustment === 'percent' || t.adjustment == null)
    .find((t) => qty >= t.fromQuantity && (t.toQuantity == null || qty <= t.toQuantity)) ?? null;
}

function nextTierFor(tiers = [], qty) {
  const next = tiers
    .filter((t) => t.fromQuantity > qty)
    .sort((a, b) => a.fromQuantity - b.fromQuantity)[0];
  return next ? { from: next.fromQuantity, pct: Number(next.value), missing: next.fromQuantity - qty } : null;
}

/* line: { product, quantity, discountPct, addOns } with `product` a catalog product object. */
function priceLine(product, line) {
  const quantity = line.quantity;
  const discountPct = line.discountPct || 0;
  const off = (price, pct) => price * (1 - pct / 100);

  if (product.type === 'Bundle') {
    const parts = (product.components ?? [])
      .filter((c) => c.required || (line.addOns ?? []).includes(c.name))
      .map((c) => {
        const unitPrice = cents(off(Number(c.listPrice) || 0, discountPct));
        return { name: c.name, billing: c.billing, listPrice: Number(c.listPrice) || 0, unitPrice, total: cents(unitPrice * quantity) };
      });
    return {
      product: product.name,
      quantity,
      discountPct,
      tierPct: 0,
      parts,
      totals: sumByBilling(parts),
      nextTier: null,
    };
  }

  const listPrice = Number(product.listPrice) || 0;
  const tier = tierFor(product.volumeTiers, quantity);
  const tierPct = tier ? Number(tier.value) : 0;
  const unitPrice = cents(off(off(listPrice, tierPct), discountPct));
  const total = cents(unitPrice * quantity);

  return {
    product: product.name,
    quantity,
    discountPct,
    tierPct,
    listPrice,
    unitPrice,
    billing: product.billing,
    total,
    totals: { [product.billing]: total },
    listTotal: cents(listPrice * quantity),
    nextTier: nextTierFor(product.volumeTiers, quantity),
  };
}

function sumByBilling(items) {
  const totals = {};
  for (const i of items) totals[i.billing] = cents((totals[i.billing] ?? 0) + i.total);
  return totals;
}

/*
 * lines: normalized quote lines; products: catalog products by exact name.
 * Returns { lines: [...priced], totals: { billing: amount }, needsApproval, maxDiscountPct }.
 */
function priceQuote(lines, productsByName, maxDiscountPct) {
  const priced = lines.map((l) => priceLine(productsByName.get(l.product), l));
  const totals = {};
  for (const p of priced) {
    for (const [billing, amount] of Object.entries(p.totals)) totals[billing] = cents((totals[billing] ?? 0) + amount);
  }
  return {
    lines: priced,
    totals,
    needsApproval: lines.some((l) => (l.discountPct || 0) > maxDiscountPct),
    maxDiscountPct,
  };
}

const grandTotalOf = (totals) => cents(Object.values(totals).reduce((a, b) => a + b, 0));

module.exports = { priceLine, priceQuote, grandTotalOf, tierFor, nextTierFor };
