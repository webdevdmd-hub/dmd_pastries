"use client";

import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { SupplierStatus } from "@/types/supplier";

const statusConfig: Record<SupplierStatus, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "border-money/30 bg-money-tint text-money-text",
  },
  inactive: {
    label: "Inactive",
    className: "border-brand-cappuccino bg-brand-latte text-brand-mocha",
  },
  blocked: {
    label: "Blocked",
    className: "border-danger/30 bg-danger-tint text-danger-text",
  },
};

export function SupplierStatusBadge({ status }: { status: SupplierStatus }): JSX.Element {
  const config = statusConfig[status];

  return (
    <Badge className={config.className} variant="outline">
      {config.label}
    </Badge>
  );
}
