import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { AccountingAccountStatus, AccountingAccountType } from "@/types/accounting";

export function ChartAccountTypeBadge({
  accountType,
}: {
  accountType: AccountingAccountType;
}): JSX.Element {
  const className =
    accountType === "asset"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : accountType === "liability"
        ? "border-red-200 bg-red-50 text-red-800"
        : accountType === "income"
          ? "border-blue-200 bg-blue-50 text-blue-800"
          : accountType === "expense" || accountType === "cogs"
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-brand-cappuccino bg-brand-latte text-brand-mocha";

  return (
    <Badge className={className} variant="outline">
      {accountType.replace("_", " ")}
    </Badge>
  );
}

export function ChartAccountStatusBadge({
  status,
}: {
  status: AccountingAccountStatus;
}): JSX.Element {
  return (
    <Badge
      className={
        status === "active"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-brand-cappuccino bg-brand-latte text-brand-mocha"
      }
      variant="outline"
    >
      {status}
    </Badge>
  );
}
