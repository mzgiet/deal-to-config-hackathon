import { motion } from 'framer-motion';
import { X, Tag, Package, Sparkles, ShoppingBag } from 'lucide-react';
import type { Attribute, AttributePriceOverride, Product } from '../types';
import { useStore } from '../store';
import { useProducts, useLivePrice } from '../hooks/useProducts';
import AttributeSelector from './AttributeSelector';
import PriceDisplay from './PriceDisplay';
import BundleComponents from './BundleComponents';

interface Props {
  product: Product;
  onClose: () => void;
}

const BRAND_BADGE: Record<string, { bg: string; text: string }> = {
  Samsung: { bg: 'bg-blue-500/15 border-blue-500/25', text: 'text-blue-400' },
  Apple: { bg: 'bg-slate-500/15 border-slate-500/25', text: 'text-slate-300' },
};

/** Return an Attribute whose values are filtered to only those configured in SF overrides. */
function resolveAttribute(
  productCode: string,
  attrCode: string,
  attributes: Record<string, Attribute>,
  overrides: AttributePriceOverride[],
): Attribute | null {
  const attr = attributes[attrCode];
  if (!attr) return null;

  const configuredValues = overrides
    .filter((o) => o.productCode === productCode && o.attributeCode === attrCode)
    .map((o) => o.attributeValue);

  if (configuredValues.length === 0) return attr;

  return {
    ...attr,
    values: attr.values.filter((v) => configuredValues.includes(v.value)),
  };
}

export default function ProductDetailDrawer({ product, onClose }: Props) {
  const { selectedAttributes, setAttributeValue, openOffer, cart } = useStore();
  const { attributes, overrides } = useProducts();
  const attrs = selectedAttributes[product.code] ?? {};
  const price = useLivePrice(product.code, product.id, attrs, product.basePrice);

  const bundleComponentCodes = product.bundleComponentCodes ?? [];

  const brandBadge = product.brand ? BRAND_BADGE[product.brand] : null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/65 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-[480px] bg-syn-surface border-l border-syn-border z-50 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-syn-border shrink-0 glass">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-syn-muted bg-syn-card border border-syn-border px-2 py-0.5 rounded">
              {product.code}
            </span>
            {product.isBundle && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-purple-400 bg-purple-400/10 border border-purple-400/20 px-2 py-0.5 rounded-full">
                <Package size={9} />
                Bundle
              </span>
            )}
            {brandBadge && product.brand && (
              <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${brandBadge.bg} ${brandBadge.text}`}>
                {product.brand}
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-syn-card hover:bg-syn-card-hover border border-syn-border text-syn-muted hover:text-syn-text flex items-center justify-center transition-all shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Hero image */}
          <div className="relative aspect-video overflow-hidden shrink-0">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80&auto=format&fit=crop';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-syn-surface via-syn-surface/30 to-transparent" />

            {/* Gradient accent line at bottom of image */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-syn-gradient opacity-60" />
          </div>

          <div className="px-6 py-6 space-y-6">
            {/* Title */}
            <div>
              <h2 className="text-2xl font-bold text-syn-text mb-2 leading-tight">{product.name}</h2>
              <p className="text-syn-secondary text-sm leading-relaxed">{product.description}</p>
            </div>

            {/* Bundle components — shown first for bundles so it's immediately visible */}
            {product.isBundle && bundleComponentCodes.length > 0 && (
              <BundleComponents
                componentCodes={bundleComponentCodes}
                optionalComponentCodes={product.bundleOptionalComponentCodes}
                bundlePrice={price}
              />
            )}

            {/* Live price box */}
            <div className="bg-syn-card rounded-xl p-4 border border-syn-border gradient-border">
              <div className="text-syn-muted text-[10px] uppercase tracking-widest mb-2">
                {product.attributeCodes.some(
                  (c) => attributes[c]?.isPriceImpacting,
                )
                  ? 'Configured Price'
                  : 'Price'}
              </div>
              <PriceDisplay price={price} pricingType={product.pricingType} />
            </div>

            {/* Attributes */}
            {product.attributeCodes.length > 0 && (
              <div className="space-y-5">
                <h3 className="text-syn-text font-semibold text-sm flex items-center gap-2">
                  <Tag size={13} className="text-syn-orange" />
                  Configuration Options
                </h3>
                {product.attributeCodes.map((attrCode) => {
                  const attr = resolveAttribute(product.code, attrCode, attributes, overrides);
                  if (!attr) return null;
                  return (
                    <AttributeSelector
                      key={attrCode}
                      attribute={attr}
                      selectedValue={attrs[attrCode] ?? attr.values[0]?.value ?? ''}
                      onChange={(value) => setAttributeValue(product.code, attrCode, value)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-syn-border shrink-0 bg-syn-surface space-y-2">
          {/* Primary CTA — changes label based on cart state */}
          {!cart.some((c) => c.productId === product.id) && (
            <button
              onClick={() => {
                openOffer({ product, selectedAttributes: attrs });
                onClose();
              }}
              className="w-full py-3 rounded-lg bg-syn-accent font-semibold text-sm text-syn-on-accent flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
            >
              <Sparkles size={15} />
              {cart.length === 0 ? 'Visualise Cart' : 'Add to Cart'}
            </button>
          )}

          {/* Secondary — Review Cart (goes to offer without adding current product) */}
          {cart.length > 0 && (
            <button
              onClick={() => {
                openOffer();
                onClose();
              }}
              className="w-full py-2.5 rounded-xl font-medium text-sm text-syn-secondary hover:text-syn-text bg-syn-card hover:bg-syn-card-hover border border-syn-border flex items-center justify-center gap-2 transition-all"
            >
              <ShoppingBag size={13} />
              Review Cart ({cart.length} item{cart.length !== 1 ? 's' : ''})
            </button>
          )}
        </div>
      </motion.aside>
    </>
  );
}
