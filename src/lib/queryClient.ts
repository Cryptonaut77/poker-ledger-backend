import { onlineManager, QueryClient } from "@tanstack/react-query";
import * as Network from "expo-network";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry failed queries up to 3 times with exponential backoff
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Consider data stale after 30 seconds
      staleTime: 30000,
      // Keep data in cache for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Refetch on window focus and reconnect to ensure fresh data
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      // Retry failed mutations once (be conservative with mutations)
      retry: 1,
      retryDelay: 1000,
    },
  },
});

onlineManager.setEventListener((setOnline) => {
  const eventSubscription = Network.addNetworkStateListener((state) => {
    setOnline(!!state.isConnected);
  });
  return eventSubscription.remove;
});

export { queryClient };
