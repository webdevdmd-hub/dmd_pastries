"use client";

import type { JSX } from "react";

import { ReportBranchSelect } from "@/components/reports/report-branch-select";
import { ReportDateRangePicker } from "@/components/reports/report-date-range-picker";
import {
  compactSummary,
  countReportFilterChanges,
  describeReportBranch,
  describeReportChoice,
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
import { resolveReportPresetRange } from "@/constants/report-presets";
import { usePaymentMethods } from "@/hooks/use-payments";
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
  const paymentMethods = usePaymentMethods().data ?? [];

  const setPreset = (datePreset: ReportDatePreset): void => {
    if (datePreset === "custom") {
      onChange({ ...filters, datePreset });
      return;
    }
    onChange({ ...filters, ...resolveReportPresetRange(datePreset), datePreset });
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
      popoverTitle="Filter financial report"
      summary={compactSummary([
        describeReportPeriod(filters.datePreset, filters.dateFrom, filters.dateTo),
        describeReportBranch(branches, filters.branchId),
        showGroupBy ? `By ${filters.groupBy}` : null,
        describeReportChoice(filters.sourceType, defaultFilters.sourceType, sourceTypeOptions),
        describeReportChoice(filters.status, defaultFilters.status, statusOptions),
        describeReportChoice(
          filters.refundStatus,
          defaultFilters.refundStatus,
          refundStatusOptions,
        ),
        filters.paymentMethodId ? "Payment method set" : null,
      ])}
    >
      <>
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
        {/* A list, not an ID box. This asked for a payment method UUID, which
            appears nowhere in the app, so the filter could not be used without
            reading the database. Same defect as ISSUE-015 on the Payments page.

            Regression: ISSUE-016 — report filters asked for UUIDs no operator can see
            Found by /qa on 2026-09-15 */}
        <div className="space-y-2">
          <label
            className="text-sm font-medium text-brand-espresso"
            htmlFor="financial-payment-method"
          >
            Payment method
          </label>
          <Select
            onValueChange={(value) =>
              onChange({ ...filters, paymentMethodId: value === allValue ? "" : value })
            }
            value={filters.paymentMethodId || allValue}
          >
            <SelectTrigger id="financial-payment-method">
              <SelectValue placeholder="All payment methods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={allValue}>All payment methods</SelectItem>
              {paymentMethods.map((method) => (
                <SelectItem key={method.id} value={method.id}>
                  {method.methodName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      </>
    </ReportFilterPopover>
  );
}
