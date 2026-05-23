"use client";

import { ApiClientError } from "@ridex/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import * as React from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: (failureCount, error) => {
              if (
                error instanceof ApiClientError &&
                [400, 401, 403, 404].includes(error.status)
              ) {
                return false;
              }
              return failureCount < 2;
            },
            refetchOnWindowFocus: true
          },
          mutations: { retry: 0 }
        }
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" ? <ReactQueryDevtools /> : null}
    </QueryClientProvider>
  );
}
