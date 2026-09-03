"use client";

import { Star } from "lucide-react";
import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import type { ReceiptLayout, ReceiptLayoutConfig, ReceiptLayoutType } from "@/types/settings";

export const receiptTypeLabels: Record<ReceiptLayoutType, string> = {
  "58mm": "58mm thermal",
  "80mm": "80mm thermal",
  a4: "A4 invoice",
  custom: "Custom size",
};

export type ReceiptFieldKey = keyof Pick<
  ReceiptLayoutConfig,
  | "showAddress"
  | "showBranchName"
  | "showBusinessName"
  | "showCashier"
  | "showCustomer"
  | "showDiscount"
  | "showLogo"
  | "showPaymentMethod"
  | "showPhone"
  | "showQrCode"
  | "showTax"
  | "showTaxNumber"
  | "showUnitPrice"
>;

export const receiptFieldOptions: { key: ReceiptFieldKey; label: string }[] = [
  { key: "showLogo", label: "Logo" },
  { key: "showBusinessName", label: "Business name" },
  { key: "showBranchName", label: "Branch name" },
  { key: "showAddress", label: "Address" },
  { key: "showPhone", label: "Phone" },
  { key: "showTaxNumber", label: "Tax/VAT number" },
  { key: "showCashier", label: "Cashier name" },
  { key: "showCustomer", label: "Customer details" },
  { key: "showUnitPrice", label: "Unit price" },
  { key: "showDiscount", label: "Discount" },
  { key: "showTax", label: "Tax" },
  { key: "showPaymentMethod", label: "Payment method" },
  { key: "showQrCode", label: "QR code / barcode" },
];

export function formatReceiptDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Unavailable"
    : new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(parsed);
}

export function receiptScopeLabel(layout: ReceiptLayout): string {
  return layout.branchName ?? "Business-wide";
}

/**
 * Status and default are two facts, not one.
 *
 * The old badge returned early when a layout was the default, so a default
 * layout that had been deactivated rendered only "Default" and never said it
 * was inactive -- the one combination where the reader most needs both.
 */
export function ReceiptLayoutStatusBadge({ layout }: { layout: ReceiptLayout }): JSX.Element {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge className="capitalize" variant={layout.status === "active" ? "secondary" : "default"}>
        {layout.status}
      </Badge>
      {layout.isDefault ? (
        <Badge className="gap-1">
          <Star className="h-3 w-3" />
          Default
        </Badge>
      ) : null}
    </span>
  );
}
