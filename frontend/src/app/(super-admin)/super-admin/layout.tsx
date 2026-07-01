"use client";

import { useRouter } from "next/navigation";
import type { JSX, ReactNode } from "react";
import { useEffect } from "react";

import { LoadingState } from "@/components/shared/loading-state";
import { SuperAdminShell } from "@/components/super-admin/super-admin-shell";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";

export default function SuperAdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): JSX.Element {
  const router = useRouter();
  const { status, user } = useAuth();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(ROUTES.login);
    }
    if (status === "authenticated" && user?.isPlatformAdmin !== true) {
      router.replace(ROUTES.dashboard);
    }
  }, [router, status, user?.isPlatformAdmin]);

  if (status !== "authenticated" || user?.isPlatformAdmin !== true) {
    return (
      <div className="min-h-screen bg-brand-latte px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <LoadingState />
        </div>
      </div>
    );
  }

  return <SuperAdminShell>{children}</SuperAdminShell>;
}
