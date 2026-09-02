import type { JSX } from "react";

import { ReportBranchSelect } from "@/components/reports/report-branch-select";
import { ReportDateRangePicker } from "@/components/reports/report-date-range-picker";
import {
  compactSummary,
  countReportFilterChanges,
  describeReportBranch,
  describeReportPeriod,
  ReportFilterPopover,
} from "@/components/reports/report-filter-popover";
import { ReportPresetSelector } from "@/components/reports/report-preset-selector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reportGroupByOptions, resolveReportPresetRange } from "@/constants/report-presets";
import type { Branch } from "@/types/branch";
import type { ReportDatePreset, ReportGroupBy } from "@/types/reports";

export type ReportFilterDraft = {
  branchId: string;
  dateFrom: string;
  datePreset: ReportDatePreset;
  dateTo: string;
  groupBy: ReportGroupBy;
};

type ReportFilterBarProps = {
  branches: Branch[];
  canAccessAllBranches: boolean;
  currentBranchId: string | null;
  defaultFilters: ReportFilterDraft;
  filters: ReportFilterDraft;
  onApply: () => void;
  onChange: (filters: ReportFilterDraft) => void;
  onReset: () => void;
};

/** Period, branch and grouping: the filters every report shares. */
export function ReportFilterBar({
  branches,
  canAccessAllBranches,
  currentBranchId,
  defaultFilters,
  filters,
  onApply,
  onChange,
  onReset,
}: ReportFilterBarProps): JSX.Element {
  const setPreset = (preset: ReportDatePreset): void => {
    if (preset === "custom") {
      onChange({ ...filters, datePreset: preset });
      return;
    }

    const range = resolveReportPresetRange(preset);
    onChange({ ...filters, ...range, datePreset: preset });
  };

  return (
    <ReportFilterPopover
      changedCount={countReportFilterChanges(filters, defaultFilters)}
      draftKey={JSON.stringify(filters)}
      onApply={onApply}
      onReset={() => {
        onChange(defaultFilters);
        onReset();
      }}
      popoverTitle="Filter report"
      summary={compactSummary([
        describeReportPeriod(filters.datePreset, filters.dateFrom, filters.dateTo),
        describeReportBranch(branches, filters.branchId),
        `By ${filters.groupBy}`,
      ])}
    >
      <ReportPresetSelector value={filters.datePreset} onChange={setPreset} />
      <ReportDateRangePicker
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        onDateFromChange={(dateFrom) => onChange({ ...filters, dateFrom, datePreset: "custom" })}
        onDateToChange={(dateTo) => onChange({ ...filters, dateTo, datePreset: "custom" })}
      />
      <ReportBranchSelect
        branches={branches}
        canAccessAllBranches={canAccessAllBranches}
        currentBranchId={currentBranchId}
        value={filters.branchId}
        onChange={(branchId) => onChange({ ...filters, branchId })}
      />
      <div className="space-y-2">
        <label
          htmlFor="report-filter-bar-group-by"
          className="text-sm font-medium text-brand-espresso"
        >
          Group by
        </label>
        <Select
          value={filters.groupBy}
          onValueChange={(groupBy: ReportGroupBy) => onChange({ ...filters, groupBy })}
        >
          <SelectTrigger id="report-filter-bar-group-by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {reportGroupByOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </ReportFilterPopover>
  );
}
