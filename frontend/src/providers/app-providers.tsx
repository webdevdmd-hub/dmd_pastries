"use client";

import type { JSX, ReactNode } from "react";
import { Toaster } from "sonner";

import { AuthProvider } from "@/providers/auth-provider";
import { ChunkReloadProvider } from "@/providers/chunk-reload-provider";
import { LiveUpdatesProvider } from "@/providers/live-updates-provider";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps): JSX.Element {
  return (
    <QueryProvider>
      <ThemeProvider>
        <AuthProvider>
          <ChunkReloadProvider />
          <LiveUpdatesProvider />
          {children}
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
