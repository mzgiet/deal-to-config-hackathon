import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, ChevronDown, X, Tag, Sparkles, PlusCircle, Settings2, Lock } from 'lucide-react';
import { useProducts, computeDefaultAttributes, useLivePrice } from '../hooks/useProducts';
import { useStore } from '../store';
import AttributeSelector from './AttributeSelector';
import type { Product, SelectedOptional } from '../types';

interface Props {
  componentCodes: string[];
  /** Codes of bundle components that are optional (in groups with MinBundleComponents=0). */
  optionalComponentCodes?: string[];
  /** Actual price of the parent bundle product — used for savings calculation. */
  bundlePrice?: number;
  /** SF Product2 Id of the parent bundle — needed to call addOptionalToBundle. */
  bundleProductId?: string;
  /** Full SelectedOptional objects (with selectedAttributes) for already-picked optionals. */
  selectedOptionals?: SelectedOptional[];
  /** Max optional components the user can select (from MaxBundleComponents). Default: unlimited. */
  maxOptionals?: number;
}

const PRICING_SUFFIX: Record<string, { label: string; className: string }> = {
  monthly: { label: '/mo', className: 'text-blue-400' },
  onetime: { label: 'one-time', className: 'text-purple-400' },
  yearly: { label: '/yr', className: 'text-green-400' },
};

/** Overlay modal for a single bundle component */
function BundleItemModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const suffix = PRICING_SUFFIX[product.pricingType] ?? { label: '', className: '' };
  return (
    <AnimatePresence>
      <motion.div
        key="modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          key="modal-panel"
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.96 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="relative w-full max-w-sm bg-syn-surface border border-syn-border rounded-2xl overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Hero image */}
          <div className="relative aspect-[16/9] overflow-hidden">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80&auto=format&fit=crop';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-syn-surface via-syn-surface/20 to-transparent" />
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 border border-white/10 text-white flex items-center justify-center transition-all"
            >
              <X size={14} />
            </button>
            <div className="absolute bottom-3 left-4">
              <span className="text-[10px] font-mono text-syn-muted bg-black/50 border border-white/10 px-2 py-0.5 rounded">
                {product.code}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="p-5 space-y-4">
            <div>
              <h3 className="text-xl font-bold text-syn-text leading-tight">{product.name}</h3>
              {product.description && (
                <p className="text-syn-secondary text-sm mt-1 leading-relaxed line-clamp-3">
                  {product.description}
                </p>
              )}
            </div>

            {/* Price */}
            <div className="flex items-center justify-between bg-syn-card border border-syn-border rounded-xl px-4 py-3">
              <div className="flex items-center gap-1.5 text-syn-muted text-xs">
                <Tag size={11} />
                Individual price
              </div>
              <div>
                <span className="text-syn-text font-bold text-lg">${product.basePrice}</span>
                <span className={`text-xs ml-0.5 ${suffix.className}`}>{suffix.label}</span>
              </div>
            </div>

            {/* Category / type chips */}
            <div className="flex flex-wrap gap-2">
              {product.brand && (
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  {product.brand}
                </span>
              )}
              {product.categoryCode && (
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-syn-card border border-syn-border text-syn-secondary">
                  {product.categoryCode}
                </span>
              )}
              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-purple-400/10 border border-purple-400/20 text-purple-400 flex items-center gap-1">
                <Sparkles size={9} />
                Included in bundle
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ComponentRow({
  product,
  idx,
  isOptional,
  isSelected,
  isExpanded,
  isDisabled,
  disabledReason,
  displayPrice,
  onInfo,
  onAdd,
  onRemove,
  onToggle,
}: {
  product: Product;
  idx: number;
  isOptional: boolean;
  isSelected?: boolean;
  isExpanded?: boolean;
  /** Unselected optional is greyed out because max cardinality is reached. */
  isDisabled?: boolean;
  /** Human-readable reason shown under a disabled row (e.g. which slot is blocking it). */
  disabledReason?: string;
  /** Pre-computed attribute-aware price — overrides product.basePrice when provided. */
  displayPrice?: number;
  onInfo: (p: Product) => void;
  onAdd?: (p: Product) => void;
  onRemove?: (p: Product) => void;
  onToggle?: () => void;
}) {
  const suffix = PRICING_SUFFIX[product.pricingType] ?? { label: '', className: '' };
  const handleRowClick = isSelected && onToggle ? onToggle : () => onInfo(product);

  return (
    <motion.div
      key={product.code}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.05, duration: 0.22 }}
      className={`rounded-xl border transition-all overflow-hidden ${
        isDisabled
          ? 'bg-syn-card/50 border-syn-border/70'
          : isOptional && isSelected
          ? 'bg-green-400/8 border-green-400/25'
          : isOptional
          ? 'bg-amber-400/5 border-amber-400/20'
          : 'bg-syn-card border-syn-border'
      }`}
    >
      {/* Row content — dimmed as a whole when disabled, but the reason strip below stays at full opacity */}
      <div
        className={`flex items-center gap-3 p-3 transition-opacity ${
          isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
        onClick={isDisabled ? undefined : handleRowClick}
      >
        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-syn-surface">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium truncate transition-colors ${
            isOptional && isSelected
              ? 'text-green-300'
              : isOptional
              ? 'text-amber-200'
              : 'text-syn-text'
          }`}>
            {product.name}
          </div>
          <div className="text-syn-muted text-[10px] font-mono">{product.code}</div>
        </div>
        <div className="text-right shrink-0">
          <span className={`text-sm font-semibold ${
            isOptional && isSelected ? 'text-green-300' : isOptional ? 'text-amber-300' : 'text-syn-text'
          }`}>
            ${(displayPrice ?? product.basePrice).toLocaleString()}
          </span>
          <span className={`text-xs ml-0.5 ${suffix.className}`}>{suffix.label}</span>
        </div>

        {/* Action button */}
        {isOptional ? (
          isSelected ? (
            <div className="flex items-center gap-1 shrink-0">
              {/* Chevron to indicate expandable config */}
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.18 }}
                className="text-green-400/60"
              >
                <ChevronDown size={12} />
              </motion.div>
              {/* Remove button */}
              <button
                onClick={(e) => { e.stopPropagation(); onRemove?.(product); }}
                title="Remove from bundle"
                className="w-6 h-6 rounded-full bg-green-400/10 border border-green-400/20 hover:bg-red-500/20 hover:border-red-500/40 flex items-center justify-center transition-all group/rm"
              >
                <X size={10} className="text-green-400 group-hover/rm:text-red-400 transition-colors" />
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); if (!isDisabled) onAdd?.(product); }}
              title={isDisabled ? disabledReason ?? 'Max reached' : 'Add to bundle'}
              disabled={isDisabled}
              className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                isDisabled
                  ? 'bg-syn-card border-syn-border cursor-not-allowed'
                  : 'bg-amber-400/15 border-amber-400/30 hover:bg-amber-400/25'
              }`}
            >
              {isDisabled ? (
                <Lock size={12} className="text-syn-muted" />
              ) : (
                <PlusCircle size={13} className="text-amber-400" />
              )}
            </button>
          )
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onInfo(product); }}
            className="w-5 h-5 rounded-full bg-purple-400/10 border border-purple-400/20 hover:bg-purple-400/20 flex items-center justify-center shrink-0 transition-all"
          >
            <ChevronDown size={10} className="text-purple-400 -rotate-90" />
          </button>
        )}
      </div>

      {/* Reason strip — full opacity so the explanation stays legible even though the row above is dimmed */}
      {isDisabled && disabledReason && (
        <div className="flex items-center gap-1.5 px-3 pb-2.5 -mt-1 text-[10px] text-syn-muted">
          <Lock size={9} className="shrink-0" />
          <span className="truncate">{disabledReason}</span>
        </div>
      )}
    </motion.div>
  );
}

/** Inline attribute configurator shown below a selected optional row */
function OptionalAttributePanel({
  product,
  selectedAttributes,
  bundleProductId,
}: {
  product: Product;
  selectedAttributes: Record<string, string>;
  bundleProductId: string;
}) {
  const { attributes, overrides } = useProducts();
  const { setOptionalAttributes } = useStore();
  const livePrice = useLivePrice(product.code, product.id, selectedAttributes, product.basePrice);
  const suffix = PRICING_SUFFIX[product.pricingType] ?? { label: '', className: '' };

  const productAttrs = product.attributeCodes
    .map((code) => {
      const attr = attributes[code];
      if (!attr || attr.values.length === 0) return null;
      const configuredValues = overrides
        .filter((o) => o.productCode === product.code && o.attributeCode === code)
        .map((o) => o.attributeValue);
      return configuredValues.length > 0
        ? { ...attr, values: attr.values.filter((v) => configuredValues.includes(v.value)) }
        : attr;
    })
    .filter(Boolean) as typeof attributes[string][];

  if (productAttrs.length === 0) return null;

  return (
    <div className="mx-1 mb-1 rounded-lg bg-syn-surface border border-green-400/15 px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-green-400 uppercase tracking-wider">
          <Settings2 size={10} />
          Configure
        </div>
        <div className="text-[12px] font-semibold text-green-300 tabular-nums">
          ${livePrice.toLocaleString()}
          <span className={`text-[10px] ml-0.5 font-normal ${suffix.className}`}>{suffix.label}</span>
        </div>
      </div>
      {productAttrs.map((attr) => (
        <AttributeSelector
          key={attr.code}
          attribute={attr}
          selectedValue={selectedAttributes[attr.code] ?? attr.values[0]?.value ?? ''}
          onChange={(value) => setOptionalAttributes(bundleProductId, product.id, attr.code, value)}
          compact
        />
      ))}
    </div>
  );
}

/**
 * Wrapper for a selected optional row — calls useLivePrice so the displayed
 * price reacts to attribute changes without breaking the hook-in-loop rule.
 */
function SelectedOptionalRow({
  product,
  selectedOpt,
  idx,
  isExpanded,
  isDisabled,
  bundleProductId,
  onInfo,
  onRemove,
  onToggle,
}: {
  product: Product;
  selectedOpt: SelectedOptional;
  idx: number;
  isExpanded: boolean;
  isDisabled: boolean;
  bundleProductId?: string;
  onInfo: (p: Product) => void;
  onRemove?: (p: Product) => void;
  onToggle?: () => void;
}) {
  const livePrice = useLivePrice(product.code, product.id, selectedOpt.selectedAttributes ?? {}, product.basePrice);
  return (
    <ComponentRow
      product={product}
      idx={idx}
      isOptional
      isSelected
      isExpanded={isExpanded}
      isDisabled={isDisabled}
      displayPrice={livePrice || product.basePrice}
      onInfo={onInfo}
      onRemove={bundleProductId ? onRemove : undefined}
      onToggle={onToggle}
    />
  );
}

export default function BundleComponents({ componentCodes, optionalComponentCodes, bundlePrice, bundleProductId, selectedOptionals, maxOptionals }: Props) {
  const { products, attributes, overrides } = useProducts();
  const { addOptionalToBundle, removeOptionalFromBundle } = useStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedOptionalId, setExpandedOptionalId] = useState<string | null>(null);
  const [focusedProduct, setFocusedProduct] = useState<Product | null>(null);

  const optionalSet = new Set(optionalComponentCodes ?? []);
  const selectedMap = new Map((selectedOptionals ?? []).map((o) => [o.productId, o]));
  const selectedCount = selectedMap.size;
  const capReached = maxOptionals !== undefined && selectedCount >= maxOptionals;

  // Explain *why* an unselected optional is locked, naming the product occupying
  // the slot when there is exactly one — that's the common "swap this for that" case.
  const selectedNames = (selectedOptionals ?? []).map((o) => o.product.name);
  const disabledReason = maxOptionals === undefined
    ? undefined
    : selectedNames.length === 1
    ? `Slot taken by "${selectedNames[0]}" — remove it to add this instead`
    : `Max ${maxOptionals} optional add-on${maxOptionals === 1 ? '' : 's'} reached`;

  const allComponents = componentCodes
    .map((code) => products.find((p) => p.code === code))
    .filter(Boolean) as Product[];

  const requiredComponents = allComponents.filter((p) => !optionalSet.has(p.code));
  const optionalComponents = allComponents.filter((p) => optionalSet.has(p.code));

  if (!allComponents.length) return null;

  const totalSeparate = requiredComponents.reduce((sum, p) => sum + (p?.basePrice ?? 0), 0);
  const effectiveBundlePrice = bundlePrice ?? 0;
  const savingsPct = totalSeparate > effectiveBundlePrice && effectiveBundlePrice > 0
    ? Math.round(((totalSeparate - effectiveBundlePrice) / totalSeparate) * 100)
    : 0;

  const handleAddOptional = (product: Product) => {
    if (!bundleProductId) return;
    const defaults = computeDefaultAttributes(product.code, product.attributeCodes, attributes, overrides);
    addOptionalToBundle(bundleProductId, product, defaults);
    setExpandedOptionalId(product.id);
    if (!isExpanded) setIsExpanded(true);
  };

  return (
    <>
      {/* Bundle item focus modal */}
      {focusedProduct && (
        <BundleItemModal product={focusedProduct} onClose={() => setFocusedProduct(null)} />
      )}

      <div className="rounded-xl border border-purple-400/20 bg-purple-400/5 overflow-hidden">
        {/* Collapsed / always-visible header */}
        <button
          onClick={() => setIsExpanded((v) => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-purple-400/8 transition-colors group"
        >
          <div className="flex items-center gap-1.5 text-purple-400">
            <Package size={14} />
            <span className="text-sm font-semibold">Bundle Includes</span>
          </div>

          {/* Thumbnail stack (visible when collapsed) */}
          <AnimatePresence>
            {!isExpanded && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="flex items-center ml-1 overflow-hidden"
              >
                <div className="flex -space-x-2">
                  {allComponents.slice(0, 4).map((p, i) => (
                    <div
                      key={p.code}
                      className="w-6 h-6 rounded-full border-2 border-syn-surface overflow-hidden bg-syn-card shrink-0"
                      style={{ zIndex: 4 - i }}
                    >
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ))}
                  {allComponents.length > 4 && (
                    <div className="w-6 h-6 rounded-full border-2 border-syn-surface bg-syn-card text-syn-muted text-[9px] font-bold flex items-center justify-center shrink-0">
                      +{allComponents.length - 4}
                    </div>
                  )}
                </div>
                <span className="ml-2 text-xs text-syn-muted whitespace-nowrap">
                  {requiredComponents.length} included
                  {optionalComponents.length > 0 && optionalComponents.length - selectedCount > 0
                    && ` · ${optionalComponents.length - selectedCount} optional`}
                  {selectedCount > 0 && ` · ${selectedCount} added`}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Savings badge */}
          {savingsPct > 0 && (
            <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-syn-success/15 border border-syn-success/25 text-syn-success whitespace-nowrap">
              Save {savingsPct}%
            </span>
          )}

          {/* Chevron toggle */}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className={`${savingsPct > 0 ? '' : 'ml-auto'} text-syn-muted group-hover:text-syn-secondary`}
          >
            <ChevronDown size={15} />
          </motion.div>
        </button>

        {/* Expandable product list */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              key="bundle-list"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <div className="px-3 pb-3 pt-1 space-y-3">
                {/* Required components */}
                {requiredComponents.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-1 mb-0.5">
                      <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider">Included</span>
                      {savingsPct > 0 && (
                        <span className="text-[10px] text-syn-muted">
                          Separately: <span className="text-syn-secondary font-semibold">${totalSeparate}/mo</span>
                        </span>
                      )}
                    </div>
                    {requiredComponents.map((product, idx) => (
                      <ComponentRow
                        key={product.code}
                        product={product}
                        idx={idx}
                        isOptional={false}
                        onInfo={setFocusedProduct}
                      />
                    ))}
                  </div>
                )}

                {/* Optional components */}
                {optionalComponents.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between px-1 mb-0.5">
                      <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                        Bundle Optionals
                      </span>
                      {maxOptionals !== undefined && (
                        <span className={`text-[10px] tabular-nums font-semibold ${
                          capReached ? 'text-green-400' : 'text-syn-muted'
                        }`}>
                          {selectedCount}/{maxOptionals} selected
                        </span>
                      )}
                    </div>
                    {optionalComponents.map((product, idx) => {
                      const selectedOpt = selectedMap.get(product.id);
                      const isSelected = !!selectedOpt;
                      const isOptExpanded = expandedOptionalId === product.id;
                      const isDisabled = !isSelected && capReached;
                      const handleRemove = bundleProductId
                        ? (p: Product) => {
                            removeOptionalFromBundle(bundleProductId, p.id);
                            if (expandedOptionalId === p.id) setExpandedOptionalId(null);
                          }
                        : undefined;
                      const handleToggle = () =>
                        setExpandedOptionalId((cur) => cur === product.id ? null : product.id);
                      return (
                        <div key={product.code}>
                          {isSelected && selectedOpt ? (
                            <SelectedOptionalRow
                              product={product}
                              selectedOpt={selectedOpt}
                              idx={requiredComponents.length + idx}
                              isExpanded={isOptExpanded}
                              isDisabled={isDisabled}
                              bundleProductId={bundleProductId}
                              onInfo={setFocusedProduct}
                              onRemove={handleRemove}
                              onToggle={handleToggle}
                            />
                          ) : (
                            <ComponentRow
                              product={product}
                              idx={requiredComponents.length + idx}
                              isOptional
                              isSelected={false}
                              isExpanded={false}
                              isDisabled={isDisabled}
                              disabledReason={isDisabled ? disabledReason : undefined}
                              onInfo={setFocusedProduct}
                              onAdd={handleAddOptional}
                              onToggle={handleToggle}
                            />
                          )}
                          {/* Inline attribute accordion */}
                          <AnimatePresence initial={false}>
                            {isSelected && isOptExpanded && bundleProductId && selectedOpt && (
                              <motion.div
                                key={`attr-${product.code}`}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                                style={{ overflow: 'hidden' }}
                              >
                                <OptionalAttributePanel
                                  product={product}
                                  selectedAttributes={selectedOpt.selectedAttributes}
                                  bundleProductId={bundleProductId}
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
