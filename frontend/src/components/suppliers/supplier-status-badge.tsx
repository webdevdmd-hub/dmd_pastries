"use client";

import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { SupplierStatus } from "@/types/supplier";

const statusConfig: Record<SupplierStatus, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  inactive: {
    label: "Inactive",
    className: "border-brand-cappuccino bg-brand-latte text-brand-mocha",
  },
  blocked: {
    label: "Blocked",
    className: "border-red-200 bg-red-50 text-red-800",
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
