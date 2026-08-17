"use client";

import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { PackagingStatus } from "@/types/packaging";

export function PackagingStatusBadge({ status }: { status: PackagingStatus }): JSX.Element {
  return (
    <Badge
      className={
        status === "active"
          ? "border-money/30 bg-money-tint text-money-text"
          : "border-brand-cappuccino bg-brand-latte text-brand-mocha"
      }
      variant="outline"
    >
      {status === "active" ? "Active" : "Inactive"}
    </Badge>
  );
}
