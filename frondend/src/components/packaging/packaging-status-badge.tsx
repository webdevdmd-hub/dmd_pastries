"use client";

import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { PackagingStatus } from "@/types/packaging";

export function PackagingStatusBadge({ status }: { status: PackagingStatus }): JSX.Element {
  return (
    <Badge
      className={
        status === "active"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-brand-cappuccino bg-brand-latte text-brand-mocha"
      }
      variant="outline"
    >
      {status === "active" ? "Active" : "Inactive"}
    </Badge>
  );
}
