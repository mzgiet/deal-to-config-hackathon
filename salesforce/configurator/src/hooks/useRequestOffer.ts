import { useQuery } from '@tanstack/react-query';
import { fetchSFRequestOffer } from '../lib/sfGraphQL';

const REQUEST_ID_PARAM = 'requestId';

export function getRequestIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get(REQUEST_ID_PARAM);
  return value?.trim() || null;
}

export function useRequestOffer(requestId: string) {
  const query = useQuery({
    queryKey: ['requestOffer', requestId],
    queryFn: () => fetchSFRequestOffer(requestId),
    staleTime: 30_000,
  });

  return {
    offer: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
