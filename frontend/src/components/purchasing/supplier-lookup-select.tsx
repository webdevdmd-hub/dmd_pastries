"use client";

import type { JSX } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  return (
    <Select
      value={value || "none"}
      onValueChange={(nextValue) => onValueChange(nextValue === "none" ? "" : nextValue)}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select supplier" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Select supplier</SelectItem>
        {suppliers.map((supplier) => (
          <SelectItem key={supplier.id} value={supplier.id}>
            {supplier.supplierName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
