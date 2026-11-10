import { useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { ArrowLeft, FileText, Plus, ShoppingBag, Sparkles, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { useProducts, useLivePrice, useCartTotal, useCartRules } from '../hooks/useProducts';
import CartItemRow from './CartItemRow';
import type { CartItem, PricingType, SelectedOptional } from '../types';

// ── Animated number ticker ────────────────────────────────────────────────────
function AnimatedTotal({ value }: { value: number }) {
  const mv = useMotionValue(value);
  const display = useTransform(mv, (v) => `$${Math.round(v).toLocaleString()}`);

  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.55, ease: 'easeOut' });
    return controls.stop;
  }, [value, mv]);

  return <motion.span>{display}</motion.span>;
}

// ── Pricing group meta (shared: group header + per-line suffix) ──────────────
const PRICING_GROUP_META: Record<PricingType, { label: string; dot: string; suffix: string }> = {
  monthly:  { label: 'Monthly recurring', dot: 'bg-blue-400',   suffix: '/mo' },
  yearly:   { label: 'Annual',            dot: 'bg-green-400',  suffix: '/yr' },
  onetime:  { label: 'One-time charges',  dot: 'bg-purple-400', suffix: ''    },
};

// ── Optional add-on sub-row ───────────────────────────────────────────────────
/**
 * Renders a single bundle optional's price line. Always resolves its OWN live/override
 * price (never the stale product.basePrice) and always uses its OWN pricing type's
 * suffix (never the parent bundle's) — a one-time phone attached to a monthly plan must
 * read "one-time", not "/mo".
 *
 * When `parentName` is set, this renders as a standalone line (used when the optional's
 * pricing type differs from its parent bundle's, so it belongs in a different group).
 */
function OptionalSummaryRow({
  opt,
  qty,
  parentName,
}: {
  opt: SelectedOptional;
  qty: number;
  parentName?: string;
}) {
  const unitPrice = useLivePrice(opt.product.code, opt.product.id, opt.selectedAttributes ?? {}, opt.product.basePrice);
  const totalPrice = unitPrice * qty;
  const suffix = PRICING_GROUP_META[opt.product.pricingType]?.suffix ?? '';

  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${parentName ? '' : 'pl-4'}`}>
      <div className={`${parentName ? 'w-7 h-7 rounded-lg' : 'w-5 h-5 rounded-md'} overflow-hidden shrink-0 bg-syn-surface border border-green-400/20`}>
        <img
          src={opt.product.imageUrl}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
      <span className="text-syn-muted text-[12px] truncate flex-1 min-w-0 italic">
        {parentName ? (
          <>
            {opt.product.name}
            <span className="text-syn-muted/60 not-italic"> · part of {parentName}</span>
          </>
        ) : (
          <>+ {opt.product.name}</>
        )}
      </span>
      <span className="text-green-400 text-[12px] font-medium shrink-0 tabular-nums">
        +${totalPrice.toLocaleString()}
        {suffix && <span className="text-green-400/60 font-normal text-[10px] ml-0.5">{suffix}</span>}
      </span>
    </div>
  );
}

// ── Per-item summary row ──────────────────────────────────────────────────────
function SummaryRow({ item, groupType }: { item: CartItem; groupType: PricingType }) {
  const unitPrice = useLivePrice(item.product.code, item.product.id, item.selectedAttributes, item.product.basePrice);
  const qty = item.quantity ?? 1;
  const totalPrice = unitPrice * qty;
  const suffix = PRICING_GROUP_META[item.product.pricingType]?.suffix ?? '';

  // Only nest optionals that share THIS group's pricing type here — optionals whose
  // pricing type differs from the parent are rendered as their own line in their own
  // group (see `orphanOptionals` in OfferSummary), so their cost isn't double counted
  // nor buried under the wrong suffix.
  const matchingOptionals = (item.selectedOptionals ?? []).filter(
    (opt) => opt.product.pricingType === groupType,
  );

  return (
    <div className="space-y-1.5">
      {/* Main product row */}
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Thumbnail */}
        <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 bg-syn-surface border border-syn-border">
          <img
            src={item.product.imageUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
        {/* Name + qty badge */}
        <span className="text-syn-secondary text-[13px] truncate flex-1 min-w-0">
          {item.product.name}
        </span>
        {qty > 1 && (
          <span className="text-[10px] font-semibold text-syn-orange bg-syn-orange/10 border border-syn-orange/20 px-1.5 py-0.5 rounded-full shrink-0 tabular-nums">
            ×{qty}
          </span>
        )}
        {/* Total price — right-aligned, tabular */}
        <div className="text-right shrink-0">
          <span className="text-syn-text font-semibold text-[13px] tabular-nums">
            ${totalPrice.toLocaleString()}
            {suffix && <span className="text-syn-muted font-normal text-[11px] ml-0.5">{suffix}</span>}
          </span>
          {qty > 1 && (
            <div className="text-[10px] text-syn-muted tabular-nums">
              ${unitPrice.toLocaleString()} each
            </div>
          )}
        </div>
      </div>

      {/* Optional add-on sub-rows (same pricing type as the parent only) */}
      {matchingOptionals.map((opt) => (
        <OptionalSummaryRow key={opt.productId} opt={opt} qty={qty} />
      ))}
    </div>
  );
}

// ── Pricing group (monthly / one-time / yearly) ───────────────────────────────
function PricingGroup({
  mainItems,
  orphanOptionals,
  cart,
  type,
}: {
  /** Top-level cart items whose OWN pricing type matches this group. */
  mainItems: CartItem[];
  /** Optionals whose pricing type matches this group but whose parent item's doesn't. */
  orphanOptionals: { parent: CartItem; opt: SelectedOptional }[];
  /** Full cart — needed so the subtotal can pick up matching optionals nested under
   *  items of a different pricing type (useCartTotal scans the whole cart itself). */
  cart: CartItem[];
  type: PricingType;
}) {
  const groupTotal = useCartTotal(cart, type);
  const meta = PRICING_GROUP_META[type];

  return (
    <div className="px-5 py-4 space-y-3">
      {/* Group header */}
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${meta.dot} shrink-0`} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-syn-muted">
          {meta.label}
        </span>
      </div>

      {/* Line items */}
      <div className="space-y-2">
        {mainItems.map((item) => (
          <SummaryRow key={item.productId} item={item} groupType={type} />
        ))}
        {orphanOptionals.map(({ parent, opt }) => (
          <OptionalSummaryRow
            key={opt.productId}
            opt={opt}
            qty={parent.quantity ?? 1}
            parentName={parent.product.name}
          />
        ))}
      </div>

      {/* Group subtotal */}
      <div className="flex justify-between items-center pt-2.5 border-t border-syn-border/50">
        <span className="text-syn-muted text-[11px]">Subtotal</span>
        <span className="text-syn-text font-bold text-base tabular-nums">
          <AnimatedTotal value={groupTotal} />
          {meta.suffix && (
            <span className="text-syn-muted text-xs font-normal ml-0.5">{meta.suffix}</span>
          )}
        </span>
      </div>
    </div>
  );
}

// ── Offer Summary panel ───────────────────────────────────────────────────────
const GROUP_ORDER: PricingType[] = ['monthly', 'yearly', 'onetime'];

function OfferSummary() {
  const { cart } = useStore();
  const { isLoading } = useProducts();

  // A pricing type is "present" if ANY top-level item OR any nested optional has it —
  // otherwise a one-time device hidden inside a monthly bundle would never surface its
  // own "One-time charges" group at all.
  const presentTypes = new Set<PricingType>();
  for (const item of cart) {
    presentTypes.add(item.product.pricingType);
    for (const opt of item.selectedOptionals ?? []) presentTypes.add(opt.product.pricingType);
  }

  return (
    <div className="bg-syn-card border border-syn-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-syn-border flex items-center justify-between">
        <p className="text-syn-muted text-[10px] uppercase tracking-widest font-semibold">
          Offer Summary
        </p>
        {cart.length > 0 && (
          <span className="text-[10px] text-syn-muted tabular-nums">
            {cart.length} item{cart.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="p-5 space-y-2.5">
          <div className="h-4 w-full bg-syn-surface animate-pulse rounded" />
          <div className="h-4 w-4/5 bg-syn-surface animate-pulse rounded" />
          <div className="h-6 w-2/5 bg-syn-surface animate-pulse rounded mt-2" />
        </div>
      ) : cart.length === 0 ? (
        <div className="px-5 py-6 text-center text-syn-muted text-sm">No items yet</div>
      ) : (
        <div className="divide-y divide-syn-border/40">
          {GROUP_ORDER.filter((type) => presentTypes.has(type)).map((type) => {
            const mainItems = cart.filter((i) => i.product.pricingType === type);
            const orphanOptionals = cart.flatMap((parent) =>
              (parent.selectedOptionals ?? [])
                .filter((opt) => opt.product.pricingType === type && parent.product.pricingType !== type)
                .map((opt) => ({ parent, opt })),
            );
            return (
              <PricingGroup
                key={type}
                mainItems={mainItems}
                orphanOptionals={orphanOptionals}
                cart={cart}
                type={type}
              />
            );
          })}
        </div>
      )}

      {/* CTA */}
      <div className="px-5 pb-5 pt-4 border-t border-syn-border space-y-2">
        <button
          className="w-full py-3 rounded-lg bg-syn-accent font-semibold text-sm text-syn-on-accent flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98]"
          onClick={() => alert('Quote creation coming in Faza 2 — will create a Salesforce Quote with these line items.')}
        >
          <FileText size={15} />
          Create Quote in Salesforce
        </button>
        <p className="text-center text-syn-muted text-[10px]">
          Creates a Draft Quote with all configured products as line items
        </p>
      </div>
    </div>
  );
}

// ── Main OfferPage ─────────────────────────────────────────────────────────────
export default function OfferPage() {
  const { cart, closeoffer, clearCart, setCategory } = useStore();
  const { products: allProducts } = useProducts();
  const { maxQuantityFor } = useCartRules(cart, allProducts);

  function backToCatalog() {
    setCategory(null); // reset to category grid (6 tiles)
    closeoffer();
  }

  return (
    <motion.div
      key="offer-view"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-screen bg-syn-bg flex flex-col"
    >
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-syn-border bg-syn-surface/80 backdrop-blur-md sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={backToCatalog}
            className="flex items-center gap-2 text-syn-secondary hover:text-syn-text text-sm font-medium transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Catalog
          </button>

          <div className="h-4 w-px bg-syn-border" />

          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-syn-orange" />
            <span className="text-syn-text font-semibold text-sm">Offer Configurator</span>
            {cart.length > 0 && (
              <span className="text-[10px] font-semibold text-syn-orange bg-syn-orange/10 border border-syn-orange/20 px-2 py-0.5 rounded-full">
                {cart.length} item{cart.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {cart.length > 0 && (
          <button
            onClick={clearCart}
            className="flex items-center gap-1.5 text-syn-muted hover:text-red-400 text-xs font-medium transition-colors"
          >
            <Trash2 size={12} />
            Clear offer
          </button>
        )}
      </header>

      {/* Body */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        {cart.length === 0 ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-[60vh] text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-syn-card border border-syn-border flex items-center justify-center mb-5">
              <ShoppingBag size={24} className="text-syn-muted" />
            </div>
            <h2 className="text-syn-text font-semibold text-xl mb-2">Offer is empty</h2>
            <p className="text-syn-secondary text-sm max-w-xs">
              Go back to the catalog, open a product and click{' '}
              <strong className="text-syn-orange">Visualize Offer</strong> to start configuring.
            </p>
            <button
              onClick={backToCatalog}
              className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-syn-card hover:bg-syn-card-hover border border-syn-border text-syn-text text-sm font-medium transition-all"
            >
              <Plus size={14} />
              Browse Catalog
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
            {/* Left: Cart items */}
            <div className="space-y-4">
              <h2 className="text-syn-text font-semibold text-base flex items-center gap-2">
                <ShoppingBag size={15} className="text-syn-orange" />
                Configured Products
              </h2>

              <AnimatePresence mode="popLayout">
                {cart.map((item) => (
                  <motion.div
                    key={item.productId}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.22 }}
                  >
                    <CartItemRow item={item} maxQuantity={maxQuantityFor(item.product.id)} />
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Add more */}
              <button
                onClick={backToCatalog}
                className="w-full py-3 rounded-2xl border border-dashed border-syn-border text-syn-muted hover:text-syn-text hover:border-syn-border-bright text-sm font-medium flex items-center justify-center gap-2 transition-all"
              >
                <Plus size={14} />
                Add another product from catalog
              </button>
            </div>

            {/* Right: Summary */}
            <div className="lg:sticky lg:top-24">
              <OfferSummary />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
