"use client";

import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { ProductStatus } from "@/types/product";

type ProductStatusBadgeProps = {
  status: ProductStatus;
};

export function ProductStatusBadge({ status }: ProductStatusBadgeProps): JSX.Element {
  if (status === "active") {
    return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Active</Badge>;
  }

  if (status === "archived") {
    return <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200">Archived</Badge>;
  }

  return (
    <Badge className="bg-brand-cappuccino/60 text-brand-mocha hover:bg-brand-cappuccino/60">
      Inactive
    </Badge>
  );
}
