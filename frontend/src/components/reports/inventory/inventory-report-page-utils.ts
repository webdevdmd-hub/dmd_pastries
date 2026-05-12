import { toast } from "sonner";

import type { InventoryReportFilterDraft } from "@/components/reports/inventory/inventory-report-filter-bar";
import { toInventoryReportFilters } from "@/components/reports/inventory/inventory-report-filter-bar";
import { inventoryReportFiltersSchema } from "@/lib/validators/inventory-reports.schema";
import type { InventoryReportFilters } from "@/types/inventory-reports";

export function defaultInventoryReportDraft(branchId: string): InventoryReportFilterDraft {
  return {
    branchId,
    dateFrom: "",
    dateTo: "",
    itemType: "all",
    status: "all",
  };
}

export function parseInventoryReportDraft(
  draft: InventoryReportFilterDraft,
): InventoryReportFilters | null {
  const filters = toInventoryReportFilters(draft);
  const parsed = inventoryReportFiltersSchema.safeParse(filters);

  if (!parsed.success) {
    toast.error(parsed.error.errors[0]?.message ?? "Inventory report filters are invalid.");
    return null;
  }

  return filters;
}
