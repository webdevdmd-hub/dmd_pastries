import type { JSX } from "react";

import { ReportBranchSelect } from "@/components/reports/report-branch-select";
import { ReportDateRangePicker } from "@/components/reports/report-date-range-picker";
import { ReportPresetSelector } from "@/components/reports/report-preset-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reportGroupByOptions, resolveReportPresetRange } from "@/constants/report-presets";
import { cn } from "@/lib/utils/cn";
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
  compact?: boolean;
};

export function ReportFilterBar({
  branches,
  canAccessAllBranches,
  currentBranchId,
  defaultFilters,
  filters,
  onApply,
  onChange,
  onReset,
  compact = false,
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
    <Card className={cn("bg-card/85 shadow-soft", compact && "rounded-md shadow-none")}>
      <CardContent
        className={cn(
          "grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-6",
          compact && "gap-3 p-4 xl:grid-cols-[8.5rem_9.5rem_9.5rem_minmax(10rem,1fr)_8.5rem_auto]",
        )}
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
          <label className="text-sm font-medium text-brand-espresso">Group by</label>
          <Select
            value={filters.groupBy}
            onValueChange={(groupBy: ReportGroupBy) => onChange({ ...filters, groupBy })}
          >
            <SelectTrigger>
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
        <div className={cn("flex items-end gap-2 xl:col-span-6", compact && "xl:col-span-1")}>
          <Button type="button" onClick={onApply}>
            Apply
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onChange(defaultFilters);
              onReset();
            }}
          >
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
