import { useQuery } from '@tanstack/react-query';
import { fetchSFCustomerQuote } from '../lib/sfGraphQL';

const QUOTE_ID_PARAM = 'quoteId';

export function getQuoteIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get(QUOTE_ID_PARAM);
  return value?.trim() || null;
}

export function useCustomerQuote(quoteId: string) {
  const query = useQuery({
    queryKey: ['customerQuote', quoteId],
    queryFn: () => fetchSFCustomerQuote(quoteId),
    staleTime: 30_000,
  });

  return {
    quote: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
