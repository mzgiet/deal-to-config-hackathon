import { TrendingUp } from 'lucide-react';
import type { Attribute } from '../types';

interface Props {
  attribute: Attribute;
  selectedValue: string;
  onChange: (value: string) => void;
  compact?: boolean;
}

export default function AttributeSelector({ attribute, selectedValue, onChange, compact = false }: Props) {
  return (
    <div>
      <div className={`flex items-center justify-between ${compact ? 'mb-1.5' : 'mb-2.5'}`}>
        <label className={`text-syn-text font-medium ${compact ? 'text-xs' : 'text-sm'}`}>
          {attribute.label}
        </label>
        {attribute.isPriceImpacting && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-syn-orange bg-syn-orange/10 border border-syn-orange/20 px-2 py-0.5 rounded-full">
            <TrendingUp size={9} />
            {compact ? '±$' : 'Affects price'}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {attribute.values.map((val) => {
          const isSelected = selectedValue === val.value;
          return (
            <button
              key={val.value}
              onClick={() => onChange(val.value)}
              className={`rounded-lg font-medium transition-all duration-200 ${
                compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
              } ${
                isSelected
                  ? 'text-white shadow-lg shadow-syn-orange/25'
                  : 'bg-syn-card border border-syn-border text-syn-secondary hover:border-syn-border-bright hover:text-syn-text'
              }`}
              style={
                isSelected
                  ? { background: 'linear-gradient(135deg, #FF5733, #8B3DFF)' }
                  : {}
              }
            >
              {val.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
