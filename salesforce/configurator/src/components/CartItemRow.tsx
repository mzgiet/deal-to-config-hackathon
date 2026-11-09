import { Minus, Plus, Trash2, Tag } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { CartItem, PricingType } from '../types';
import type { SFPricebookEntry } from '../lib/sfGraphQL';
import { useStore } from '../store';
import { useProducts, useLivePrice, resolveEffectivePrice } from '../hooks/useProducts';
import AttributeSelector from './AttributeSelector';
import PriceDisplay from './PriceDisplay';
import BundleComponents from './BundleComponents';
import CartItemBundleSuggestion from './CartItemBundleSuggestion';

const PRICING_SUFFIX_LABEL: Record<PricingType, string> = {
  monthly: '/mo',
  yearly: '/yr',
  onetime: 'one-time',
};

interface Props {
  item: CartItem;
  /** Max units allowed for this product (from cardinality rules). Default 10. */
  maxQuantity?: number;
}

export default function CartItemRow({ item, maxQuantity = 10 }: Props) {
  const { removeFromCart, updateCartItemAttributes, setCartItemQuantity } = useStore();
  const { attributes, overrides } = useProducts();
  const { product, selectedAttributes, quantity = 1 } = item;
  const queryClient = useQueryClient();
  const sfPrices = queryClient.getQueryData<SFPricebookEntry[]>(['sf-prices']);

  const price = useLivePrice(product.code, product.id, selectedAttributes, product.basePrice);

  // Sum of live prices for selected optional bundle components (attribute-aware),
  // split by the optional's OWN pricing type — a one-time device attached to a
  // monthly plan must never be folded into the "/mo" figure below, otherwise it
  // reads as though it recurs every month. Uses resolveEffectivePrice (same
  // resolution order as useCartTotal) so this never drifts out of sync again.
  const optionalsByType = new Map<PricingType, number>();
  for (const opt of item.selectedOptionals ?? []) {
    const optPrice = resolveEffectivePrice(
      opt.product.code,
      opt.product.id,
      opt.product.basePrice,
      opt.selectedAttributes ?? {},
      overrides,
      sfPrices,
    );
    optionalsByType.set(opt.product.pricingType, (optionalsByType.get(opt.product.pricingType) ?? 0) + optPrice);
  }
  const sameTypeOptionalsPrice = optionalsByType.get(product.pricingType) ?? 0;
  const otherTypeOptionalTotals = [...optionalsByType.entries()].filter(([type]) => type !== product.pricingType);

  const productAttrs = product.attributeCodes
    .map((code) => {
      const attr = attributes[code];
      if (!attr) return null;

      const configuredValues = overrides
        .filter((o) => o.productCode === product.code && o.attributeCode === code)
        .map((o) => o.attributeValue);

      return configuredValues.length > 0
        ? { ...attr, values: attr.values.filter((v) => configuredValues.includes(v.value)) }
        : attr;
    })
    .filter(Boolean) as typeof attributes[string][];

  return (
    <div className="bg-syn-card border border-syn-border rounded-2xl overflow-hidden group transition-all hover:border-syn-border-bright">
      {/* Product header */}
      <div className="flex items-start gap-4 p-4 pb-3">
        {/* Thumbnail */}
        <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-syn-surface border border-syn-border">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1518770660439-4636190af475?w=200&q=70&auto=format&fit=crop';
            }}
          />
        </div>

        {/* Name + code + price */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-syn-text font-semibold text-sm leading-snug truncate">
                {product.name}
              </p>
              <span className="text-[10px] font-mono text-syn-muted bg-syn-surface border border-syn-border px-1.5 py-0.5 rounded mt-1 inline-block">
                {product.code}
              </span>
            </div>
            <button
              onClick={() => removeFromCart(product.id)}
              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-syn-muted hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
              title="Remove from offer"
            >
              <Trash2 size={13} />
            </button>
          </div>

          {/* Live price + quantity control */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div>
              <PriceDisplay price={(price + sameTypeOptionalsPrice) * quantity} pricingType={product.pricingType} compact />
              {otherTypeOptionalTotals.map(([type, amount]) => (
                <div key={type} className="text-[11px] text-syn-muted mt-0.5">
                  + ${(amount * quantity).toLocaleString()} {PRICING_SUFFIX_LABEL[type]}
                </div>
              ))}
            </div>

            {/* Quantity stepper */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => {
                  if (quantity <= 1) removeFromCart(product.id);
                  else setCartItemQuantity(product.id, quantity - 1);
                }}
                className="w-6 h-6 rounded-md bg-syn-surface border border-syn-border hover:border-syn-border-bright flex items-center justify-center text-syn-muted hover:text-syn-text transition-all"
                title={quantity <= 1 ? 'Remove' : 'Decrease quantity'}
              >
                {quantity <= 1 ? <Trash2 size={10} className="text-red-400/70" /> : <Minus size={10} />}
              </button>

              <span className="w-6 text-center text-xs font-semibold text-syn-text tabular-nums">
                {quantity}
              </span>

              <button
                onClick={() => setCartItemQuantity(product.id, quantity + 1)}
                disabled={quantity >= maxQuantity}
                className="w-6 h-6 rounded-md bg-syn-surface border border-syn-border hover:border-syn-border-bright flex items-center justify-center text-syn-muted hover:text-syn-text transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title={quantity >= maxQuantity ? `Max ${maxQuantity} allowed` : 'Increase quantity'}
              >
                <Plus size={10} />
              </button>

              {maxQuantity <= 1 && (
                <span className="text-[9px] text-amber-400/70 ml-0.5 whitespace-nowrap">max 1</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Attributes */}
      {productAttrs.length > 0 && (
        <div className="px-4 pb-4 space-y-3 border-t border-syn-border/60 pt-3">
          <p className="text-[10px] font-semibold text-syn-muted uppercase tracking-wider flex items-center gap-1.5">
            <Tag size={9} className="text-syn-orange" />
            Configuration
          </p>
          {productAttrs.map((attr) => (
            <AttributeSelector
              key={attr.code}
              attribute={attr}
              selectedValue={selectedAttributes[attr.code] ?? attr.values[0]?.value ?? ''}
              onChange={(value) =>
                updateCartItemAttributes(product.id, attr.code, value)
              }
              compact
            />
          ))}
        </div>
      )}

      {/* Bundle components (when this item IS a bundle) */}
      {product.isBundle && product.bundleComponentCodes && product.bundleComponentCodes.length > 0 && (
        <div className="px-4 pb-4 border-t border-syn-border/60 pt-3">
          <BundleComponents
            componentCodes={product.bundleComponentCodes}
            optionalComponentCodes={product.bundleOptionalComponentCodes}
            bundlePrice={price}
            bundleProductId={product.id}
            selectedOptionals={item.selectedOptionals}
            maxOptionals={product.bundleMaxOptionalComponents}
          />
        </div>
      )}

      {/* Bundle suggestion strip (when this item could be upgraded to a bundle) */}
      {!product.isBundle && (
        <CartItemBundleSuggestion productCode={product.code} />
      )}
    </div>
  );
}
