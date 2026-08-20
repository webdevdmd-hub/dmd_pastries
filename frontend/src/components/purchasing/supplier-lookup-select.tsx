"use client";

import type { JSX } from "react";
import { useMemo } from "react";

import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import type { PurchasingSupplierOption } from "@/types/purchasing";

export function SupplierLookupSelect({
  disabled = false,
  id,
  onValueChange,
  suppliers,
  value,
}: {
  disabled?: boolean;
  /** Passed to the combobox trigger so a visible label can point at it. */
  id?: string | undefined;
  onValueChange: (supplierId: string) => void;
  suppliers: PurchasingSupplierOption[];
  value: string;
}): JSX.Element {
  const supplierOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      suppliers.map((supplier) => ({
        value: supplier.id,
        label: supplier.supplierName,
        keywords: [supplier.supplierName],
      })),
    [suppliers],
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
