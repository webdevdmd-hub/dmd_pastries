import type { ReportFilterDraft } from "@/components/reports/report-filter-bar";
import { resolveReportPresetRange } from "@/constants/report-presets";
import type { ReportFilters } from "@/types/reports";

export function resolveDashboardTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dubai";
  } catch {
    return "Asia/Dubai";
  }
}

export function createDefaultDashboardDraft(branchId: string): ReportFilterDraft {
  return {
    ...resolveReportPresetRange("this_month"),
    branchId,
    datePreset: "this_month",
    groupBy: "day",
  };
}

export function toDashboardReportFilters(
  draft: ReportFilterDraft,
  timezone: string,
): ReportFilters {
  return {
    ...(draft.branchId === "all"
      ? { branchId: "all", scope: "all_branches" as const }
      : draft.branchId
        ? { branchId: draft.branchId, scope: "current_branch" as const }
        : { scope: "current_branch" as const }),
    dateFrom: draft.dateFrom,
    dateTo: draft.dateTo,
    groupBy: draft.groupBy,
    timezone,
  };
}
