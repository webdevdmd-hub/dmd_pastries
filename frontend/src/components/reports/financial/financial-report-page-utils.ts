import { toast } from "sonner";

import type { FinancialReportFilterDraft } from "@/components/reports/financial/financial-report-filter-bar";
import { toFinancialReportFilters } from "@/components/reports/financial/financial-report-filter-bar";
import { resolveReportPresetRange } from "@/constants/report-presets";
import { financialReportFiltersSchema } from "@/lib/validators/financial-reports.schema";
import type { FinancialReportFilters } from "@/types/financial-reports";

export function defaultFinancialReportDraft(branchId: string): FinancialReportFilterDraft {
  return {
    ...resolveReportPresetRange("this_month"),
    branchId,
    datePreset: "this_month",
    groupBy: "day",
    paymentMethodId: "",
    refundStatus: "all",
    sourceType: "all",
    status: "all",
  };
}

export function parseFinancialReportDraft(
  draft: FinancialReportFilterDraft,
): FinancialReportFilters | null {
  const filters = toFinancialReportFilters(draft);
  const parsed = financialReportFiltersSchema.safeParse(filters);
  if (!parsed.success) {
    toast.error(parsed.error.errors[0]?.message ?? "Financial report filters are invalid.");
    return null;
  }
  return filters;
}
