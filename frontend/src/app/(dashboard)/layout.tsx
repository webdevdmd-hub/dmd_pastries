"use client";

import { useRouter } from "next/navigation";
import type { JSX, ReactNode } from "react";
import { useEffect } from "react";

import { ConfirmProvider } from "@/components/app/confirm-provider";
import { DensityProvider } from "@/components/density/density-provider";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { LoadingState } from "@/components/shared/loading-state";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): JSX.Element {
  const router = useRouter();
  const { isAuthenticated, status, user } = useAuth();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(ROUTES.login);
    }
    if (status === "authenticated" && user?.isPlatformAdmin) {
      router.replace(ROUTES.superAdmin);
    }
  }, [router, status, user?.isPlatformAdmin]);

  if (!isAuthenticated || user?.isPlatformAdmin) {
    return (
      <div className="min-h-screen bg-canvas px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <LoadingState />
        </div>
      </div>
    );
  }

  // Ledger register: 36px controls, 44px rows (DESIGN.md §1). Stated explicitly
  // rather than relying on :root's default, so portalled content gets the
  // attribute re-stamped and a dashboard dialog cannot silently inherit counter
  // sizing if a POS surface is ever rendered nearby.
  //
  // ConfirmProvider is what lets this tree use useConfirm(). Without it the
  // destructive actions in master data, settings and purchasing had no styled
  // confirmation available and fell back to window.confirm.
  return (
    <DensityProvider value="ledger">
      <ConfirmProvider>
        <DashboardShell>{children}</DashboardShell>
      </ConfirmProvider>
    </DensityProvider>
  );
}
