import { toast } from "sonner";

import type { BakeryOrdersReportFilterDraft } from "@/components/reports/bakery-orders/bakery-orders-report-filter-bar";
import { toBakeryOrdersReportFilters } from "@/components/reports/bakery-orders/bakery-orders-report-filter-bar";
import { resolveReportPresetRange } from "@/constants/report-presets";
import { bakeryOrdersReportFiltersSchema } from "@/lib/validators/bakery-orders-reports.schema";
import type { BakeryOrdersReportFilters } from "@/types/bakery-orders-reports";

export function defaultBakeryOrdersReportDraft(branchId: string): BakeryOrdersReportFilterDraft {
  return {
    ...resolveReportPresetRange("this_month"),
    branchId,
    customerId: "",
    datePreset: "this_month",
    groupBy: "day",
    orderStatus: "all",
    orderType: "all",
    paymentStatus: "all",
  };
}

export function parseBakeryOrdersReportDraft(
  draft: BakeryOrdersReportFilterDraft,
): BakeryOrdersReportFilters | null {
  const filters = toBakeryOrdersReportFilters(draft);
  const parsed = bakeryOrdersReportFiltersSchema.safeParse(filters);
  if (!parsed.success) {
    toast.error(parsed.error.errors[0]?.message ?? "Bakery orders report filters are invalid.");
    return null;
  }
  return filters;
}
