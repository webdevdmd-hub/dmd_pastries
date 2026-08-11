"use client";

import { useRouter } from "next/navigation";
import type { JSX, ReactNode } from "react";
import { useEffect } from "react";

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
      <div className="flex h-screen w-screen items-center justify-center bg-brand-latte">
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#f9f9fa] text-zinc-950">{children}</div>
  );
}
