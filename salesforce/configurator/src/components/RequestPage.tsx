import { useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase,
  Check,
  ExternalLink,
  FileText,
  Home,
  Info,
  Loader2,
  MessageSquareQuote,
  Package,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { useRequestOffer } from '../hooks/useRequestOffer';
import { BRAND } from '../theme';
import { createSFQuote, type CreatedQuote } from '../lib/sfGraphQL';
import { buildPriceBands, formatMoney, priceForQuantity } from '../lib/requestPricing';
import type {
  Audience,
  Billing,
  ConfigurationRequest,
  RequestBundle,
  RequestBundleComponent,
  RequestProduct,
} from '../types';

type Side = Exclude<Audience, 'Both'>;

const CHANNEL_LABEL: Record<string, string> = {
  slack: 'Slack',
  teams: 'Microsoft Teams',
  cursor: 'Cursor',
  api: 'API',
};

const SIDE_LABEL: Record<Side, { label: string; customers: string }> = {
  Business: { label: 'Business', customers: 'business customers' },
  Consumer: { label: 'Consumer', customers: 'consumers' },
};

function isAvailableFor(product: RequestProduct, side: Side): boolean {
  return product.audience === 'Both' || product.audience === side;
}

// ── Header ────────────────────────────────────────────────────────────────────
function RequestNav({
  request,
  side,
  onSideChange,
}: {
  request: ConfigurationRequest | null;
  side: Side;
  onSideChange: (side: Side) => void;
}) {
  return (
    <nav className="sticky top-0 z-50 glass keyline-bottom border-x-0 border-t-0 shrink-0">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-4">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="leading-none">
            <div className="text-syn-text font-semibold text-sm tracking-wider">SYNECHRON</div>
            <div className="text-syn-accent text-[10px] font-semibold tracking-[0.15em] uppercase mt-1">Sales Copilot</div>
          </div>
        </div>

        {request && (
          <>
            <div className="w-px h-7 bg-syn-border mx-1" />
            <span className="text-xs font-medium text-syn-secondary bg-syn-card border border-syn-border px-2.5 py-1 rounded-full whitespace-nowrap shrink-0">
              from {CHANNEL_LABEL[request.channel] ?? request.channel}
            </span>
            <span className="text-xs text-syn-muted font-mono truncate">{request.requestId}</span>
          </>
        )}

        <div className="ml-auto flex items-center gap-1 bg-syn-card border border-syn-border rounded-lg p-1">
          {(['Business', 'Consumer'] as Side[]).map((option) => {
            const Icon = option === 'Business' ? Briefcase : Home;
            const active = option === side;
            return (
              <button
                key={option}
                onClick={() => onSideChange(option)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  active ? 'text-syn-on-accent' : 'text-syn-secondary hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="side-pill"
                    className="absolute inset-0 rounded-md bg-syn-accent"
                    transition={{ type: 'spring', damping: 22, stiffness: 320 }}
                  />
                )}
                <Icon size={13} className="relative z-10" />
                <span className="relative z-10">{SIDE_LABEL[option].label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

// ── Request summary ───────────────────────────────────────────────────────────
function RequestSummary({ request }: { request: ConfigurationRequest }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 text-syn-accent text-xs font-semibold tracking-[0.15em] uppercase">
        <Sparkles size={13} />
        Configured from a request
      </div>
      <h1 className="text-2xl md:text-3xl font-bold text-syn-text leading-snug max-w-4xl">
        {request.summary}
      </h1>

      <div className="grid md:grid-cols-2 gap-3">
        {request.rawRequest && (
          <div className="bg-syn-card border border-syn-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-syn-muted text-[11px] font-semibold tracking-wider uppercase mb-2">
              <MessageSquareQuote size={13} />
              What was asked
            </div>
            <p className="text-syn-secondary text-sm italic leading-relaxed">“{request.rawRequest}”</p>
          </div>
        )}
        {request.assumptions.length > 0 && (
          <div className="bg-syn-card border border-syn-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-syn-muted text-[11px] font-semibold tracking-wider uppercase mb-2">
              <Info size={13} />
              Assumptions
            </div>
            <ul className="space-y-1">
              {request.assumptions.map((assumption) => (
                <li key={assumption} className="text-syn-secondary text-sm">
                  · {assumption}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Availability banner ───────────────────────────────────────────────────────
function NotAvailable({ product, side }: { product: RequestProduct; side: Side }) {
  const other: Side = side === 'Business' ? 'Consumer' : 'Business';
  return (
    <div className="absolute inset-0 z-10 rounded-xl bg-syn-bg/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6">
      <div className="text-syn-text font-semibold">Not available for {SIDE_LABEL[side].customers}</div>
      <p className="text-syn-muted text-sm mt-1">
        {product.name} is offered to {SIDE_LABEL[other].customers} only.
      </p>
    </div>
  );
}

function ProductHeading({ product }: { product: RequestProduct }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-syn-text">{product.name}</h2>
        <p className="text-syn-muted text-xs font-mono mt-0.5">{product.code}</p>
      </div>
      <span className="text-[11px] font-semibold text-syn-secondary bg-syn-surface border border-syn-border px-2.5 py-1 rounded-full shrink-0">
        {product.audience === 'Both' ? 'Business & Consumer' : product.audience}
      </span>
    </div>
  );
}

// ── Volume tier layout ────────────────────────────────────────────────────────
function VolumeTierCard({ product, side }: { product: RequestProduct; side: Side }) {
  const listPrice = product.unitPrice ?? 0;
  const bands = useMemo(() => buildPriceBands(listPrice, product.tiers), [listPrice, product.tiers]);
  const lastFrom = bands[bands.length - 1].fromQuantity;
  const maxQuantity = Math.max(100, Math.ceil((lastFrom * 1.5) / 50) * 50);
  const [quantity, setQuantity] = useState(product.tiers[0]?.fromQuantity ?? 1);
  const price = priceForQuantity(bands, quantity);
  const saving = price.listTotal - price.total;

  return (
    <div className="relative bg-syn-card border border-syn-border rounded-xl p-6 space-y-6">
      {!isAvailableFor(product, side) && <NotAvailable product={product} side={side} />}
      <ProductHeading product={product} />

      <div className="grid md:grid-cols-[1.1fr_1fr] gap-6">
        <div>
          <div className="text-syn-muted text-[11px] font-semibold tracking-wider uppercase mb-2">
            Volume pricing
          </div>
          <div className="rounded-xl border border-syn-border overflow-hidden">
            {bands.map((band) => {
              const active = band === price.band;
              return (
                <div
                  key={band.fromQuantity}
                  className={`flex items-center gap-3 px-4 py-3 text-sm border-b border-syn-border last:border-b-0 transition-colors ${
                    active ? 'bg-syn-gradient-subtle shadow-[inset_3px_0_0_#FBF321]' : ''
                  }`}
                >
                  <span className={`w-28 tabular-nums ${active ? 'text-syn-text font-semibold' : 'text-syn-secondary'}`}>
                    {band.toQuantity === null
                      ? `${band.fromQuantity.toLocaleString()}+`
                      : `${band.fromQuantity.toLocaleString()}–${band.toQuantity.toLocaleString()}`}{' '}
                    units
                  </span>
                  <span className="flex-1 text-syn-muted text-xs">
                    {band.discountPct > 0 ? `${band.discountPct}% off` : 'list price'}
                  </span>
                  <span className={`tabular-nums font-semibold ${active ? 'text-syn-text' : 'text-syn-secondary'}`}>
                    {formatMoney(band.unitPrice)}
                    <span className="text-syn-muted font-normal text-xs"> / unit</span>
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-syn-muted text-xs mt-2">
            The rate of the band you reach applies to every unit.
          </p>
        </div>

        <div className="bg-syn-surface border border-syn-border rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between">
            <label htmlFor={`qty-${product.id}`} className="text-syn-muted text-[11px] font-semibold tracking-wider uppercase">
              Quantity
            </label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              className="w-24 bg-syn-card border border-syn-border rounded-lg px-2 py-1 text-right text-syn-text tabular-nums text-sm focus:outline-none focus:border-syn-accent"
            />
          </div>
          <input
            id={`qty-${product.id}`}
            type="range"
            min={1}
            max={maxQuantity}
            value={Math.min(quantity, maxQuantity)}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full mt-4 accent-[#FBF321]"
          />

          <div className="mt-auto pt-6 space-y-1">
            <div className="text-syn-muted text-xs tabular-nums">
              {quantity.toLocaleString()} × {formatMoney(price.unitPrice)}
            </div>
            <motion.div
              key={price.total}
              initial={{ scale: 1.04, color: BRAND.flash }}
              animate={{ scale: 1, color: BRAND.text }}
              transition={{ duration: 0.4 }}
              className="text-4xl font-bold tracking-tight tabular-nums"
            >
              {formatMoney(price.total)}
            </motion.div>
            <div className={`text-sm tabular-nums ${saving > 0 ? 'text-syn-success' : 'text-syn-muted'}`}>
              {saving > 0 ? `You save ${formatMoney(saving)} vs list price` : 'List price'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Flat layout ───────────────────────────────────────────────────────────────
function FlatCard({ product, side }: { product: RequestProduct; side: Side }) {
  return (
    <div className="relative bg-syn-card border border-syn-border rounded-xl p-6 space-y-4">
      {!isAvailableFor(product, side) && <NotAvailable product={product} side={side} />}
      <ProductHeading product={product} />
      <div className="text-4xl font-bold text-syn-text tracking-tight tabular-nums">
        {product.unitPrice === null ? '—' : formatMoney(product.unitPrice)}
        <span className="text-syn-muted text-base font-normal">
          {product.billing === 'monthly' ? ' / month' : ' / unit'}
        </span>
      </div>
    </div>
  );
}

// ── Bundle layout ─────────────────────────────────────────────────────────────
const BILLING_LABEL: Record<Billing, string> = { monthly: 'per month', 'one-time': 'one-time' };

function CreateQuoteButton({ requestId, addOns }: { requestId: string; addOns: string[] }) {
  const [state, setState] = useState<
    { kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; quote: CreatedQuote } | { kind: 'error'; message: string }
  >({ kind: 'idle' });
  const addOnKey = addOns.join('|');
  const [quotedKey, setQuotedKey] = useState<string | null>(null);
  const isStale = state.kind === 'done' && quotedKey !== addOnKey;

  const create = async () => {
    setState({ kind: 'busy' });
    try {
      const quote = await createSFQuote(requestId, addOns);
      setQuotedKey(addOnKey);
      setState({ kind: 'done', quote });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  if (state.kind === 'done' && !isStale) {
    return (
      <a
        href={state.quote.quoteUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 rounded-xl border border-syn-success/40 bg-syn-success/10 px-4 py-3 text-sm font-semibold text-syn-success hover:bg-syn-success/20 transition-colors"
      >
        <Check size={16} />
        Quote created{state.quote.grandTotal !== null && ` · ${formatMoney(state.quote.grandTotal)}`} — open in Salesforce
        <ExternalLink size={14} />
      </a>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={create}
        disabled={state.kind === 'busy'}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-syn-accent px-4 py-3 text-sm font-semibold text-syn-on-accent hover:brightness-95 disabled:opacity-60 transition"
      >
        {state.kind === 'busy' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
        {state.kind === 'busy' ? 'Creating quote…' : isStale ? 'Create a new quote' : 'Create quote'}
      </button>
      {state.kind === 'error' && <p className="text-xs text-syn-danger">{state.message}</p>}
    </div>
  );
}

function BundleCard({ bundle, side, requestId }: { bundle: RequestBundle; side: Side; requestId: string }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const included = (c: RequestBundleComponent) => !c.isOptional || selected.has(c.product.id);
  const totals = bundle.components.filter(included).reduce(
    (sum, c) => {
      sum[c.product.billing] += (c.product.unitPrice ?? 0) * c.quantity;
      return sum;
    },
    { monthly: 0, 'one-time': 0 } as Record<Billing, number>,
  );
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="relative bg-syn-card border border-syn-border rounded-xl p-6 space-y-6">
      {!isAvailableFor(bundle.product, side) && <NotAvailable product={bundle.product} side={side} />}
      <ProductHeading product={bundle.product} />

      <div className="grid md:grid-cols-[1.1fr_1fr] gap-6">
        <div className="space-y-2">
          <div className="text-syn-muted text-[11px] font-semibold tracking-wider uppercase mb-2">
            What's in the bundle
          </div>
          {bundle.components.map((component) => {
            const { product } = component;
            const on = included(component);
            return (
              <div
                key={product.id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  on ? 'border-syn-border-bright bg-syn-gradient-subtle shadow-[inset_3px_0_0_#FBF321]' : 'border-syn-border'
                }`}
              >
                {component.isOptional ? (
                  <button
                    role="switch"
                    aria-checked={on}
                    aria-label={`Add ${product.name}`}
                    onClick={() => toggle(product.id)}
                    className={`relative w-9 h-5 rounded-full shrink-0 transition-colors ${on ? 'bg-syn-accent' : 'bg-syn-border-bright'}`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${on ? 'left-[18px] bg-syn-primary' : 'left-0.5 bg-white'}`}
                    />
                  </button>
                ) : (
                  <Check size={18} className="text-syn-success shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-syn-text text-sm font-semibold">
                    {component.quantity > 1 && `${component.quantity} × `}
                    {product.name}
                  </div>
                  <div className="text-syn-muted text-xs">
                    {component.isOptional ? 'Optional add-on' : 'Included'}
                    {product.fromCatalog && ' · already in the catalog'}
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <div className={`text-sm font-semibold ${on ? 'text-syn-text' : 'text-syn-secondary'}`}>
                    {product.unitPrice === null ? '—' : formatMoney(product.unitPrice)}
                  </div>
                  <div className="text-syn-muted text-[11px]">{BILLING_LABEL[product.billing]}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-syn-surface border border-syn-border rounded-xl p-5 flex flex-col gap-5">
          {(['monthly', 'one-time'] as Billing[])
            .filter((billing) => bundle.components.some((c) => c.product.billing === billing))
            .map((billing) => (
              <div key={billing}>
                <div className="text-syn-muted text-[11px] font-semibold tracking-wider uppercase">
                  {billing === 'monthly' ? 'Monthly' : 'One-time'}
                </div>
                <motion.div
                  key={totals[billing]}
                  initial={{ scale: 1.04, color: BRAND.flash }}
                  animate={{ scale: 1, color: BRAND.text }}
                  transition={{ duration: 0.4 }}
                  className="text-4xl font-bold tracking-tight tabular-nums"
                >
                  {formatMoney(totals[billing])}
                  {billing === 'monthly' && <span className="text-syn-muted text-base font-normal"> / month</span>}
                </motion.div>
              </div>
            ))}
          <p className="text-syn-muted text-xs mt-auto">Turn on an add-on to see how it changes the price.</p>
          <CreateQuoteButton
            requestId={requestId}
            addOns={bundle.components.filter((c) => c.isOptional && selected.has(c.product.id)).map((c) => c.product.name)}
          />
        </div>
      </div>
    </div>
  );
}

// ── Page states ───────────────────────────────────────────────────────────────
function Message({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="max-w-xl mx-auto mt-24 text-center bg-syn-card border border-syn-border rounded-xl p-8">
      <div className="flex justify-center text-syn-accent mb-3">{icon}</div>
      <div className="text-syn-text font-semibold text-lg">{title}</div>
      <p className="text-syn-muted text-sm mt-2">{text}</p>
    </div>
  );
}

export default function RequestPage({ requestId }: { requestId: string }) {
  const { offer, isLoading, error } = useRequestOffer(requestId);
  const [chosenSide, setChosenSide] = useState<Side | null>(null);
  const requestSide: Side = offer?.request.audience === 'Consumer' ? 'Consumer' : 'Business';
  const side = chosenSide ?? requestSide;

  let body: ReactNode;
  if (isLoading) {
    body = (
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-4">
        <div className="h-6 w-56 rounded bg-syn-card animate-pulse" />
        <div className="h-10 w-3/4 rounded bg-syn-card animate-pulse" />
        <div className="h-64 rounded-xl bg-syn-card animate-pulse" />
      </div>
    );
  } else if (error) {
    body = <Message icon={<TriangleAlert size={28} />} title="Could not load the request" text={error} />;
  } else if (!offer) {
    body = (
      <Message
        icon={<TriangleAlert size={28} />}
        title="Request not found"
        text={`No configuration exists for request ${requestId}. The link may be from another org, or the request was reset.`}
      />
    );
  } else {
    const { request, products, bundle } = offer;
    body = (
      <motion.main
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-6xl mx-auto px-6 py-10 space-y-8"
      >
        <RequestSummary request={request} />

        {request.pricingType === 'bundle' && !bundle ? (
          <Message
            icon={<Package size={28} />}
            title="Bundle not found"
            text="This request describes a bundle, but no bundle product was built for it."
          />
        ) : (
          <div className="space-y-4">
            {bundle && <BundleCard bundle={bundle} side={side} requestId={request.requestId} />}
            {products.map((product) =>
              request.pricingType === 'volume-tier' && product.tiers.length > 0 ? (
                <VolumeTierCard key={product.id} product={product} side={side} />
              ) : (
                <FlatCard key={product.id} product={product} side={side} />
              ),
            )}
          </div>
        )}

        <footer className="text-syn-muted text-xs pt-2">
          Built in Salesforce Revenue Cloud on {new Date(request.createdDate).toLocaleString()}. Prices follow the
          org's price book and volume schedule.
        </footer>
      </motion.main>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <RequestNav request={offer?.request ?? null} side={side} onSideChange={setChosenSide} />
      {body}
    </div>
  );
}
