import { toast } from "sonner";

import type { ManufacturingReportFilterDraft } from "@/components/reports/manufacturing/manufacturing-report-filter-bar";
import { toManufacturingReportFilters } from "@/components/reports/manufacturing/manufacturing-report-filter-bar";
import { resolveReportPresetRange } from "@/constants/report-presets";
import { manufacturingReportFiltersSchema } from "@/lib/validators/manufacturing-reports.schema";
import type { ManufacturingReportFilters } from "@/types/manufacturing-reports";

export function defaultManufacturingReportDraft(branchId: string): ManufacturingReportFilterDraft {
  return {
    ...resolveReportPresetRange("this_month"),
    batchStatus: "all",
    branchId,
    datePreset: "this_month",
    groupBy: "day",
    productId: "",
    recipeId: "",
  };
}

export function parseManufacturingReportDraft(
  draft: ManufacturingReportFilterDraft,
): ManufacturingReportFilters | null {
  const filters = toManufacturingReportFilters(draft);
  const parsed = manufacturingReportFiltersSchema.safeParse(filters);
  if (!parsed.success) {
    toast.error(parsed.error.errors[0]?.message ?? "Manufacturing report filters are invalid.");
    return null;
  }
  return filters;
}
