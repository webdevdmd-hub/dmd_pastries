"use client";

import { useRouter } from "next/navigation";
import type { JSX, ReactNode } from "react";
import { useEffect } from "react";

import { DensityProvider } from "@/components/density/density-provider";
import { LoadingState } from "@/components/shared/loading-state";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";

export default function POSLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): JSX.Element {
  const router = useRouter();
  const { isAuthenticated, status } = useAuth();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(ROUTES.login);
    }
  }, [router, status]);

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-canvas">
        <LoadingState />
      </div>
    );
  }

  // Two mechanisms, both needed (DESIGN.md §1, §4; UI-REBUILD-PLAN §9.1).
  //
  // `data-density` on the div covers everything rendered inside it. The
  // DensityProvider covers everything Radix portals OUT of it — dialog, sheet,
  // popover, select, dropdown-menu all mount on document.body, where the
  // attribute cannot reach them, so without the provider they inherit :root's
  // ledger register and render 36px controls on a touchscreen. That included
  // pos-checkout-dialog, which is where money is actually taken.
  return (
    <DensityProvider value="counter">
      <div
        className="h-screen w-screen overflow-hidden bg-canvas text-foreground"
        data-density="counter"
      >
        {children}
      </div>
    </DensityProvider>
  );
}
