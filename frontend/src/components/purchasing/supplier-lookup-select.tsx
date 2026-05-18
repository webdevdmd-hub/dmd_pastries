"use client";

import type { JSX } from "react";
import { useMemo } from "react";

import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import type { PurchasingSupplierOption } from "@/types/purchasing";

export function SupplierLookupSelect({
  onValueChange,
  suppliers,
  value,
}: {
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
      emptyMessage="No matching suppliers found."
      onValueChange={onValueChange}
      options={supplierOptions}
      placeholder="Select supplier"
      searchPlaceholder="Search supplier..."
      value={value}
    />
  );
}
