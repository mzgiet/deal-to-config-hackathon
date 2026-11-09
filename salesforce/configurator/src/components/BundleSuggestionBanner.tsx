import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, Package } from 'lucide-react';
import { useStore } from '../store';
import { useProducts } from '../hooks/useProducts';
import type { CartItem, Product } from '../types';

interface BundleSuggestion {
  bundle: Product;
  /** Cart items that are components of this bundle */
  coveredItems: CartItem[];
  /** Sum of covered items' base prices if bought individually */
  individualTotal: number;
  /** Bundle base price */
  bundleTotal: number;
  /** Absolute savings */
  savings: number;
  /** Percentage savings */
  savingsPct: number;
}

function useBundleSuggestions(): BundleSuggestion[] {
  const { cart } = useStore();
  const { bundleSuggestionsMap, products: allProducts } = useProducts();

  const cartProductIds = new Set(cart.map((ci) => ci.productId));
  const seenBundleIds = new Set<string>();
  const suggestions: BundleSuggestion[] = [];

  for (const cartItem of cart) {
    if (cartItem.product.isBundle) continue;

    const possibleBundles = bundleSuggestionsMap[cartItem.product.code] ?? [];

    for (const bundle of possibleBundles) {
      if (seenBundleIds.has(bundle.id)) continue;
      if (cartProductIds.has(bundle.id)) continue; // bundle already in cart

      // Cart items that overlap with this bundle (for the "switch" action)
      const coveredItems = cart.filter(
        (ci) => !ci.product.isBundle && bundle.bundleComponentCodes?.includes(ci.product.code),
      );

      // Compare ALL bundle components' individual prices vs bundle price
      const allComponents = (bundle.bundleComponentCodes ?? [])
        .map((code) => allProducts.find((p) => p.code === code))
        .filter(Boolean) as Product[];

      const individualTotal = allComponents.reduce((sum, p) => sum + p.basePrice, 0);
      const bundleTotal = bundle.basePrice;
      const savings = individualTotal - bundleTotal;
      const savingsPct = individualTotal > 0 ? Math.round((savings / individualTotal) * 100) : 0;

      if (savings > 0) {
        suggestions.push({ bundle, coveredItems, individualTotal, bundleTotal, savings, savingsPct });
        seenBundleIds.add(bundle.id);
      }
    }
  }

  return suggestions;
}

function SuggestionCard({ suggestion }: { suggestion: BundleSuggestion }) {
  const { swapWithBundle } = useStore();
  const { bundle, coveredItems, individualTotal, bundleTotal, savingsPct } = suggestion;

  const priceSuffix = bundle.pricingType === 'monthly' ? '/mo'
    : bundle.pricingType === 'yearly' ? '/yr'
    : '';

  function handleSwitch() {
    swapWithBundle(
      coveredItems.map((ci) => ci.productId),
      bundle,
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-syn-success/25 bg-syn-success/5 overflow-hidden"
    >
      {/* Header strip */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-syn-success/10 border-b border-syn-success/15">
        <Sparkles size={12} className="text-syn-success shrink-0" />
        <span className="text-[11px] font-semibold text-syn-success uppercase tracking-wide">
          Bundle deal available
        </span>
        <span className="ml-auto text-[10px] font-bold text-syn-success bg-syn-success/15 border border-syn-success/25 px-2 py-0.5 rounded-full">
          Save {savingsPct}%
        </span>
      </div>

      {/* Body */}
      <div className="p-4 flex items-start gap-4">
        {/* Bundle thumbnail */}
        <div className="shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-syn-surface border border-syn-border">
          <img
            src={bundle.imageUrl}
            alt={bundle.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&q=70&auto=format&fit=crop';
            }}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Package size={11} className="text-syn-success shrink-0" />
            <span className="text-[10px] font-semibold text-syn-success uppercase tracking-wide">
              {bundle.code}
            </span>
          </div>
          <p className="text-syn-text font-semibold text-sm leading-snug">{bundle.name}</p>

          {/* Covered items preview */}
          <p className="text-syn-secondary text-xs mt-1 leading-relaxed">
            Includes{' '}
            <span className="text-syn-text font-medium">
              {coveredItems.map((ci) => ci.product.name).join(' + ')}
            </span>
            {bundle.bundleComponentCodes &&
              bundle.bundleComponentCodes.length > coveredItems.length && (
                <span className="text-syn-muted">
                  {' '}+ {bundle.bundleComponentCodes.length - coveredItems.length} more
                </span>
              )}
          </p>

          {/* Price comparison */}
          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-syn-muted text-xs line-through">
              ${individualTotal}{priceSuffix} separately
            </span>
            <span className="text-syn-muted">→</span>
            <span className="text-syn-success font-bold text-sm">
              ${bundleTotal}{priceSuffix}
            </span>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={handleSwitch}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-syn-success/15 hover:bg-syn-success/25 border border-syn-success/30 text-syn-success text-xs font-semibold transition-all active:scale-95 whitespace-nowrap"
        >
          Switch
          <ArrowRight size={12} />
        </button>
      </div>
    </motion.div>
  );
}

export default function BundleSuggestionBanner() {
  const suggestions = useBundleSuggestions();

  return (
    <AnimatePresence mode="popLayout">
      {suggestions.map((s) => (
        <SuggestionCard key={s.bundle.id} suggestion={s} />
      ))}
    </AnimatePresence>
  );
}
