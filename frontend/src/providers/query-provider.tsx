"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { JSX, ReactNode } from "react";
import { useState } from "react";

type QueryProviderProps = {
  children: ReactNode;
};

export function QueryProvider({ children }: QueryProviderProps): JSX.Element {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            // A tab that was hidden, or a terminal that lost wifi, catches up
            // the moment it is looked at again. Live updates cover the rest.
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            // Reference data (branches, tags, mappings, product lists) is read
            // by several components on one page. With staleTime 0 the second
            // one to mount after the first fetch settled refetched the same
            // URL. Half a minute of freshness dedupes those; mutations still
            // invalidate their keys explicitly.
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}
