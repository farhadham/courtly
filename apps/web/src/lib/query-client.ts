import { QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from './api';

/**
 * Shared cache. A 4xx is a decision, not a blip, so it is not retried; server
 * and network failures get two more attempts.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiRequestError && error.status < 500) {
          return false;
        }

        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
