"use client";

import type { JSX } from "react";

import { ReportBranchSelect } from "@/components/reports/report-branch-select";
import { ReportDateRangePicker } from "@/components/reports/report-date-range-picker";
import { ReportPresetSelector } from "@/components/reports/report-preset-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { resolveReportPresetRange } from "@/constants/report-presets";
import type { Branch } from "@/types/branch";
import type { FinancialReportFilters, FinancialReportGroupBy } from "@/types/financial-reports";
import type { ReportDatePreset } from "@/types/reports";

const allValue = "all";

type FinancialReportSelectOption = {
  label: string;
  value: string;
};

const defaultSourceTypeOptions: FinancialReportSelectOption[] = [
  { label: "All sources", value: "all" },
  { label: "POS sale", value: "pos_sale" },
  { label: "Bakery order", value: "bakery_order" },
  { label: "Purchase invoice", value: "purchase_invoice" },
];

const defaultStatusOptions: FinancialReportSelectOption[] = [
  { label: "All statuses", value: "all" },
  { label: "Completed", value: "completed" },
  { label: "Pending", value: "pending" },
  { label: "Failed", value: "failed" },
  { label: "Paid", value: "paid" },
  { label: "Partial", value: "partial" },
  { label: "Unpaid", value: "unpaid" },
];

const defaultRefundStatusOptions: FinancialReportSelectOption[] = [
  { label: "Financial impact", value: "all" },
  { label: "Completed", value: "completed" },
  { label: "Pending", value: "pending" },
  { label: "Failed", value: "failed" },
];

export type FinancialReportFilterDraft = {
  branchId: string;
  dateFrom: string;
  datePreset: ReportDatePreset;
  dateTo: string;
  groupBy: FinancialReportGroupBy;
  paymentMethodId: string;
  refundStatus: string;
  sourceType: string;
  status: string;
};

export function toFinancialReportFilters(
  filters: FinancialReportFilterDraft,
): FinancialReportFilters {
  return {
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    groupBy: filters.groupBy,
    ...(filters.paymentMethodId ? { paymentMethodId: filters.paymentMethodId } : {}),
    ...(filters.refundStatus !== allValue ? { refundStatus: filters.refundStatus } : {}),
    ...(filters.sourceType !== allValue ? { sourceType: filters.sourceType } : {}),
    ...(filters.status !== allValue ? { status: filters.status } : {}),
  };
}

export function FinancialReportFilterBar({
  branches,
  canAccessAllBranches,
  currentBranchId,
  defaultFilters,
  filters,
  onApply,
  onChange,
  onReset,
  refundStatusOptions = defaultRefundStatusOptions,
  showGroupBy = true,
  sourceTypeOptions = defaultSourceTypeOptions,
  statusOptions = defaultStatusOptions,
}: {
  branches: Branch[];
  canAccessAllBranches: boolean;
  currentBranchId: string | null;
  defaultFilters: FinancialReportFilterDraft;
  filters: FinancialReportFilterDraft;
  onApply: () => void;
  onChange: (filters: FinancialReportFilterDraft) => void;
  onReset: () => void;
  refundStatusOptions?: FinancialReportSelectOption[];
  showGroupBy?: boolean;
  sourceTypeOptions?: FinancialReportSelectOption[];
  statusOptions?: FinancialReportSelectOption[];
}): JSX.Element {
  const setPreset = (datePreset: ReportDatePreset): void => {
    if (datePreset === "custom") {
      onChange({ ...filters, datePreset });
      return;
    }
    onChange({ ...filters, ...resolveReportPresetRange(datePreset), datePreset });
  };

  return (
    <Card className="bg-card/85 shadow-soft">
      <CardContent className="grid grid-cols-2 gap-3 p-4 sm:gap-4 sm:p-5 xl:grid-cols-6">
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
            className="text-sm font-medium text-brand-espresso"
            htmlFor="financial-payment-method"
          >
            Payment method ID
          </label>
          <Input
            id="financial-payment-method"
            placeholder="Optional payment method UUID"
            value={filters.paymentMethodId}
            onChange={(event) => onChange({ ...filters, paymentMethodId: event.target.value })}
          />
        </div>
        {showGroupBy ? (
          <div className="space-y-2">
            <label
              htmlFor="financial-report-filter-bar-group-by"
              className="text-sm font-medium text-brand-espresso"
            >
              Group by
            </label>
            <Select
              value={filters.groupBy}
              onValueChange={(groupBy: FinancialReportGroupBy) => onChange({ ...filters, groupBy })}
            >
              <SelectTrigger id="financial-report-filter-bar-group-by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {sourceTypeOptions.length > 0 ? (
          <div className="space-y-2">
            <label
              htmlFor="financial-report-filter-bar-source-type"
              className="text-sm font-medium text-brand-espresso"
            >
              Source type
            </label>
            <Select
              value={filters.sourceType}
              onValueChange={(sourceType) => onChange({ ...filters, sourceType })}
            >
              <SelectTrigger id="financial-report-filter-bar-source-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sourceTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {statusOptions.length > 0 ? (
          <div className="space-y-2">
            <label
              htmlFor="financial-report-filter-bar-status"
              className="text-sm font-medium text-brand-espresso"
            >
              Status
            </label>
            <Select
              value={filters.status}
              onValueChange={(status) => onChange({ ...filters, status })}
            >
              <SelectTrigger id="financial-report-filter-bar-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {refundStatusOptions.length > 0 ? (
          <div className="space-y-2">
            <label
              htmlFor="financial-report-filter-bar-refund-status"
              className="text-sm font-medium text-brand-espresso"
            >
              Refund status
            </label>
            <Select
              value={filters.refundStatus}
              onValueChange={(refundStatus) => onChange({ ...filters, refundStatus })}
            >
              <SelectTrigger id="financial-report-filter-bar-refund-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {refundStatusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="flex items-end gap-2 xl:col-span-6">
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
