import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronDown, ArrowRight, Package } from 'lucide-react';
import { useStore } from '../store';
import { useProducts } from '../hooks/useProducts';
import type { Product } from '../types';

interface BundleOption {
  bundle: Product;
  allComponents: Product[];
  individualTotal: number;
  savingsPct: number;
}

function useBundleOptions(productCode: string): BundleOption[] {
  const { bundleSuggestionsMap, products: allProducts } = useProducts();
  const { cart } = useStore();

  const cartProductIds = new Set(cart.map((ci) => ci.productId));
  const possibleBundles = bundleSuggestionsMap[productCode] ?? [];

  return possibleBundles
    .filter((bundle) => !cartProductIds.has(bundle.id))
    .map((bundle) => {
      const allComponents = (bundle.bundleComponentCodes ?? [])
        .map((code) => allProducts.find((p) => p.code === code))
        .filter(Boolean) as Product[];

      const individualTotal = allComponents.reduce((sum, p) => sum + p.basePrice, 0);
      const savings = individualTotal - bundle.basePrice;
      const savingsPct = individualTotal > 0 ? Math.round((savings / individualTotal) * 100) : 0;
      if (savings <= 0) return null;

      return { bundle, allComponents, individualTotal, savingsPct };
    })
    .filter(Boolean) as BundleOption[];
}

// ── Single bundle option card (shown when expanded) ───────────────────────────
function BundleOptionCard({
  option,
  coveredProductCode,
}: {
  option: BundleOption;
  coveredProductCode: string;
}) {
  const { swapWithBundle, cart } = useStore();
  const { bundle, allComponents, individualTotal } = option;

  const priceSuffix = bundle.pricingType === 'monthly' ? '/mo'
    : bundle.pricingType === 'yearly' ? '/yr'
    : '';

  const coveredCartItems = cart.filter(
    (ci) => !ci.product.isBundle && bundle.bundleComponentCodes?.includes(ci.product.code),
  );

  // Components not currently in cart (the "extra" value the user gets)
  const extraComponents = allComponents.filter((c) => c.code !== coveredProductCode);

  function handleSwitch() {
    swapWithBundle(
      coveredCartItems.map((ci) => ci.productId),
      bundle,
    );
  }

  return (
    <div className="rounded-xl border border-syn-success/20 bg-syn-success/5 overflow-hidden">
      <div className="flex items-start gap-3 p-3">
        {/* Bundle thumbnail */}
        <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-syn-surface border border-syn-border">
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
          <div className="flex items-center gap-1.5 mb-0.5">
            <Package size={10} className="text-syn-success shrink-0" />
            <span className="text-[10px] font-semibold text-syn-success font-mono">{bundle.code}</span>
          </div>
          <p className="text-syn-text font-semibold text-sm leading-tight">{bundle.name}</p>

          {/* Extra components you'd get */}
          {extraComponents.length > 0 && (
            <p className="text-syn-secondary text-[11px] mt-1 leading-snug">
              Also includes:{' '}
              <span className="text-syn-text font-medium">
                {extraComponents.slice(0, 2).map((c) => c.name).join(', ')}
                {extraComponents.length > 2 && ` +${extraComponents.length - 2} more`}
              </span>
            </p>
          )}

          {/* Price comparison */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="text-syn-muted text-[11px] line-through">
              ${individualTotal}{priceSuffix} separately
            </span>
            <span className="text-syn-muted text-[10px]">→</span>
            <span className="text-syn-success font-bold text-sm">
              ${bundle.basePrice}{priceSuffix}
            </span>
          </div>
        </div>

        {/* Switch CTA */}
        <button
          onClick={handleSwitch}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-syn-success/15 hover:bg-syn-success/25 border border-syn-success/30 text-syn-success text-[11px] font-semibold transition-all active:scale-95 whitespace-nowrap"
        >
          Switch
          <ArrowRight size={11} />
        </button>
      </div>
    </div>
  );
}

// ── Main component — attaches to bottom of a CartItemRow ──────────────────────
export default function CartItemBundleSuggestion({ productCode }: { productCode: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const options = useBundleOptions(productCode);

  if (!options.length) return null;

  const topSavingsPct = Math.max(...options.map((o) => o.savingsPct));
  const label = options.length === 1
    ? `${options[0].bundle.name} available`
    : `${options.length} bundle deals`;

  return (
    <div className="border-t border-syn-success/20">
      {/* Toggle strip */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-syn-success/5 transition-colors group"
      >
        <Sparkles size={11} className="text-syn-success shrink-0" />
        <span className="text-[11px] font-semibold text-syn-success flex-1 text-left">
          {label}
        </span>
        <span className="text-[10px] font-bold text-syn-success bg-syn-success/15 border border-syn-success/25 px-1.5 py-0.5 rounded-full">
          Save up to {topSavingsPct}%
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-syn-success/70 group-hover:text-syn-success"
        >
          <ChevronDown size={13} />
        </motion.div>
      </button>

      {/* Expandable panel */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="bundle-suggestion-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-3 pb-3 space-y-2">
              {options.map((option) => (
                <BundleOptionCard
                  key={option.bundle.id}
                  option={option}
                  coveredProductCode={productCode}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
