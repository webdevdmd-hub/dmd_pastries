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
      ? "border-money/30 bg-money-tint text-money-text"
      : accountType === "liability"
        ? "border-danger/30 bg-danger-tint text-danger-text"
        : accountType === "income"
          ? "border-info/30 bg-info-tint text-info-text"
          : accountType === "expense" || accountType === "cogs"
            ? "border-warning/30 bg-warning-tint text-warning-text"
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
          ? "border-money/30 bg-money-tint text-money-text"
          : "border-brand-cappuccino bg-brand-latte text-brand-mocha"
      }
      variant="outline"
    >
      {status}
    </Badge>
  );
}
