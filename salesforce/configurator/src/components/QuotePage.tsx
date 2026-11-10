import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Check, Clock, FileText, PiggyBank, Sparkles, TrendingUp, TriangleAlert, Users } from 'lucide-react';
import { useCustomerQuote } from '../hooks/useCustomerQuote';
import { formatMoney } from '../lib/requestPricing';
import { HighlightsCard, Message } from './RequestPage';
import type { Billing, CustomerQuote, CustomerQuoteLine, PresentationSection, VolumeTier } from '../types';

const NEEDS_REVIEW = 'Needs Review';
const PERIOD: Record<Billing, string> = { monthly: ' / month', 'one-time': '' };

function reachedTier(line: CustomerQuoteLine): VolumeTier | null {
  return (
    line.tiers.find(
      (t) => line.quantity >= t.fromQuantity && (t.toQuantity === null || line.quantity <= t.toQuantity),
    ) ?? null
  );
}

function nextTier(line: CustomerQuoteLine): VolumeTier | null {
  return line.tiers.find((t) => t.fromQuantity > line.quantity) ?? null;
}

/** Lines that carry a price; bundle parents are priced through their components. */
function pricedLines(quote: CustomerQuote): CustomerQuoteLine[] {
  return quote.lines.filter((line) => line.listPrice > 0 || line.total > 0);
}

function StatusBadge({ status }: { status: string }) {
  const awaiting = status === NEEDS_REVIEW;
  return (
    <span
      className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
        awaiting
          ? 'text-syn-accent bg-syn-surface border-syn-accent/40'
          : 'text-syn-success bg-syn-success/10 border-syn-success/40'
      }`}
    >
      {awaiting ? <Clock size={12} /> : <Check size={12} />}
      {awaiting ? 'Awaiting manager approval' : 'Ready to send'}
    </span>
  );
}

function QuoteHeader({ quote }: { quote: CustomerQuote }) {
  const presentation = quote.presentation;
  const customer = presentation?.customerName ?? quote.accountName;
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-syn-accent text-xs font-semibold tracking-[0.15em] uppercase">
          <Sparkles size={13} />
          {presentation ? 'Composed for this deal' : 'Proposal'}
        </div>
        {customer && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-syn-text bg-syn-gradient-subtle border border-syn-border-bright px-2.5 py-1 rounded-full">
            <Users size={12} />
            Prepared for {customer}
            {presentation?.customerQuantity && ` · ${presentation.customerQuantity.toLocaleString()} users`}
          </span>
        )}
        <StatusBadge status={quote.status} />
      </div>
      <h1 className="text-2xl md:text-3xl font-bold text-syn-text leading-snug max-w-4xl">
        {presentation?.headline ?? quote.name}
      </h1>
    </section>
  );
}

function SavingsCard({ quote, title }: { quote: CustomerQuote; title?: string }) {
  const lines = pricedLines(quote);
  const billings = (['monthly', 'one-time'] as Billing[]).filter((b) => lines.some((l) => l.billing === b));
  const customer = quote.presentation?.customerName ?? quote.accountName ?? 'the customer';
  const upsell = lines.map((line) => ({ line, tier: nextTier(line) })).find((x) => x.tier);

  return (
    <div className="relative overflow-hidden bg-syn-card border border-syn-border-bright rounded-xl p-6">
      <div className="absolute inset-0 bg-syn-gradient-subtle pointer-events-none" />
      <div className="relative space-y-5">
        <div className="flex items-center gap-2 text-syn-accent text-[11px] font-semibold tracking-wider uppercase">
          <PiggyBank size={14} />
          {title ?? `What ${customer} saves`}
        </div>
        {billings.map((billing) => {
          const billed = lines.filter((l) => l.billing === billing);
          const total = billed.reduce((sum, l) => sum + l.total, 0);
          const saving = billed.reduce((sum, l) => sum + l.listPrice * l.quantity, 0) - total;
          return (
            <div key={billing} className="grid md:grid-cols-3 gap-4">
              <div>
                <div className="text-syn-muted text-xs">{billing === 'monthly' ? 'Monthly' : 'One-time'}</div>
                <div className="text-4xl font-bold text-syn-text tracking-tight tabular-nums mt-1">
                  {formatMoney(total)}
                  <span className="text-syn-muted text-base font-normal">{PERIOD[billing]}</span>
                </div>
              </div>
              <div>
                <div className="text-syn-muted text-xs">Saved vs list price</div>
                <div
                  className={`text-4xl font-bold tracking-tight tabular-nums mt-1 ${
                    saving > 0 ? 'text-syn-success' : 'text-syn-secondary'
                  }`}
                >
                  {formatMoney(saving)}
                  <span className="text-syn-muted text-base font-normal">{PERIOD[billing]}</span>
                </div>
                {billing === 'monthly' && saving > 0 && (
                  <div className="text-syn-success text-xs tabular-nums mt-1">{formatMoney(saving * 12)} a year</div>
                )}
              </div>
              <ul className="space-y-1 self-center">
                {billed.map((line) => {
                  const tier = reachedTier(line);
                  return (
                    <li key={line.productId} className="text-syn-secondary text-xs">
                      {line.quantity.toLocaleString()} × {line.productName}
                      {tier && ` · ${tier.discountPct}% volume rate`}
                      {line.discountPct ? ` · ${line.discountPct}% extra discount` : ''}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {upsell?.tier && (
          <div className="bg-syn-surface border border-syn-border rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-syn-text text-sm font-semibold">
              <TrendingUp size={14} className="text-syn-accent" />
              {(upsell.tier.fromQuantity - upsell.line.quantity).toLocaleString()} more {upsell.line.productName} to
              reach {upsell.tier.discountPct}% off
            </div>
            <p className="text-syn-muted text-xs mt-1">
              From {upsell.tier.fromQuantity.toLocaleString()} units the volume rate applies to every unit.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function QuoteLinesCard({ quote }: { quote: CustomerQuote }) {
  const lines = pricedLines(quote);
  return (
    <div className="bg-syn-card border border-syn-border rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2 text-syn-muted text-[11px] font-semibold tracking-wider uppercase">
        <FileText size={13} />
        {quote.name}
      </div>
      <div className="rounded-xl border border-syn-border overflow-hidden">
        {lines.map((line) => {
          const unit = line.quantity > 0 ? line.total / line.quantity : 0;
          return (
            <div
              key={line.productId}
              className="flex items-center gap-4 px-4 py-3 text-sm border-b border-syn-border last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <div className="text-syn-text font-semibold">{line.productName}</div>
                <div className="text-syn-muted text-xs tabular-nums">
                  {line.quantity.toLocaleString()} × {formatMoney(Math.round(unit * 100) / 100)}
                  {unit < line.listPrice && (
                    <span className="line-through ml-1.5">{formatMoney(line.listPrice)}</span>
                  )}
                  {PERIOD[line.billing]}
                </div>
              </div>
              <div className="text-right tabular-nums text-syn-text font-semibold">
                {formatMoney(line.total)}
                <span className="text-syn-muted text-xs font-normal">{PERIOD[line.billing]}</span>
              </div>
            </div>
          );
        })}
      </div>
      {quote.status === NEEDS_REVIEW && (
        <p className="text-syn-accent text-xs">
          The discount on this proposal is above what a sales rep can give; a manager approves it before it is sent.
        </p>
      )}
    </div>
  );
}

function QuoteSection({ section, quote }: { section: PresentationSection; quote: CustomerQuote }) {
  switch (section.type) {
    case 'savings':
      return <SavingsCard quote={quote} title={section.title} />;
    case 'highlights':
      return section.items.length > 0 ? <HighlightsCard section={section} /> : null;
    case 'offer':
      return <QuoteLinesCard quote={quote} />;
    default:
      return null;
  }
}

export default function QuotePage({ quoteId }: { quoteId: string }) {
  const { quote, isLoading, error } = useCustomerQuote(quoteId);

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
    body = <Message icon={<TriangleAlert size={28} />} title="Could not load the proposal" text={error} />;
  } else if (!quote) {
    body = (
      <Message
        icon={<TriangleAlert size={28} />}
        title="Proposal not found"
        text={`No quote ${quoteId} is visible here. The link may be from another org.`}
      />
    );
  } else {
    const sections: PresentationSection[] = quote.presentation?.sections.length
      ? quote.presentation.sections
      : [{ type: 'offer', items: [] }];
    body = (
      <motion.main
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-6xl mx-auto px-6 py-10 space-y-8"
      >
        <QuoteHeader quote={quote} />
        {sections.map((section, index) => (
          <motion.div
            key={section.type}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.08 * index }}
          >
            <QuoteSection section={section} quote={quote} />
          </motion.div>
        ))}
        <footer className="text-syn-muted text-xs pt-2">
          Priced by Salesforce Revenue Cloud on {new Date(quote.createdDate).toLocaleString()}.
        </footer>
      </motion.main>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="sticky top-0 z-50 glass keyline-bottom border-x-0 border-t-0 shrink-0">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-2.5">
          <div className="leading-none">
            <div className="text-syn-text font-semibold text-sm tracking-wider">SYNECHRON</div>
            <div className="text-syn-accent text-[10px] font-semibold tracking-[0.15em] uppercase mt-1">Sales Copilot</div>
          </div>
        </div>
      </nav>
      {body}
    </div>
  );
}
