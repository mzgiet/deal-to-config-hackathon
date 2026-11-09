import { useEffect, useRef, useState } from 'react';
import type { PricingType } from '../types';

interface Props {
  price: number;
  pricingType: PricingType;
  compact?: boolean;
}

const SUFFIX: Record<PricingType, string> = {
  monthly: '/mo',
  onetime: '',
  yearly: '/yr',
};

const SUFFIX_COLOR: Record<PricingType, string> = {
  monthly: 'text-blue-400',
  onetime: 'text-purple-400',
  yearly: 'text-green-400',
};

const SUFFIX_LABEL: Record<PricingType, string> = {
  monthly: 'per month',
  onetime: 'one-time purchase',
  yearly: 'per year',
};

export default function PriceDisplay({ price, pricingType, compact = false }: Props) {
  const [flash, setFlash] = useState(false);
  const prevRef = useRef(price);

  useEffect(() => {
    if (price !== prevRef.current) {
      prevRef.current = price;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 550);
      return () => clearTimeout(t);
    }
  }, [price]);

  if (compact) {
    return (
      <div className={`flex items-baseline gap-1 transition-all duration-200 ${flash ? 'animate-price-flash' : ''}`}>
        <span className="text-lg font-bold text-syn-text tracking-tight">
          ${price.toLocaleString()}
        </span>
        {SUFFIX[pricingType] && (
          <span className={`text-xs font-medium ${SUFFIX_COLOR[pricingType]}`}>
            {SUFFIX[pricingType]}
          </span>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        className={`flex items-baseline gap-2 transition-all duration-200 ${
          flash ? 'animate-price-flash' : ''
        }`}
      >
        <span className="text-4xl font-bold text-syn-text tracking-tight">
          ${price.toLocaleString()}
        </span>
        {SUFFIX[pricingType] && (
          <span className={`text-base font-medium ${SUFFIX_COLOR[pricingType]}`}>
            {SUFFIX[pricingType]}
          </span>
        )}
      </div>
      <p className="text-syn-muted text-xs mt-0.5">{SUFFIX_LABEL[pricingType]}</p>
    </div>
  );
}
