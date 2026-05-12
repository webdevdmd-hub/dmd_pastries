"use client";

import { useRouter } from "next/navigation";
import type { JSX, ReactNode } from "react";
import { useEffect } from "react";

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
  const { status } = useAuth();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(ROUTES.login);
    }
  }, [router, status]);

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen bg-brand-latte px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <LoadingState />
        </div>
      </div>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
