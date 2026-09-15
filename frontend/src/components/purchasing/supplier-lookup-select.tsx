"use client";

import type { JSX } from "react";
import { useMemo } from "react";

import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import type { SupplierUse } from "@/lib/purchasing/supplier-use";
import { supplierOptionsFor, supplierStatusNote } from "@/lib/purchasing/supplier-use";
import type { PurchasingSupplierOption } from "@/types/purchasing";

export function SupplierLookupSelect({
  disabled = false,
  id,
  onValueChange,
  suppliers,
  use,
  value,
}: {
  disabled?: boolean;
  /** Passed to the combobox trigger so a visible label can point at it. */
  id?: string | undefined;
  onValueChange: (supplierId: string) => void;
  suppliers: PurchasingSupplierOption[];
  /**
   * Required, so every picker states what it is for. The list includes
   * inactive and blocked suppliers; offering them to a new purchase order
   * invites a refusal, and hiding them from a payment hides a bill the server
   * will let you pay.
   */
  use: SupplierUse;
  value: string;
}): JSX.Element {
  const supplierOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      supplierOptionsFor(suppliers, use, value).map((supplier) => ({
        value: supplier.id,
        label: supplier.supplierName,
        description: supplierStatusNote(supplier.status),
        keywords: [supplier.supplierName],
      })),
    [suppliers, use, value],
  );

  return (
    <SearchableCombobox
      disabled={disabled}
      emptyMessage="No matching suppliers found."
      id={id}
      onValueChange={onValueChange}
      options={supplierOptions}
      placeholder="Select supplier"
      searchPlaceholder="Search supplier..."
      value={value}
    />
  );
}
