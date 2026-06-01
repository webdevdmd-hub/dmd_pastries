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
}: {
  branches: Branch[];
  canAccessAllBranches: boolean;
  currentBranchId: string | null;
  defaultFilters: FinancialReportFilterDraft;
  filters: FinancialReportFilterDraft;
  onApply: () => void;
  onChange: (filters: FinancialReportFilterDraft) => void;
  onReset: () => void;
}): JSX.Element {
  const setPreset = (datePreset: ReportDatePreset): void => {
    if (datePreset === "custom") {
      onChange({ ...filters, datePreset });
      return;
    }
    onChange({ ...filters, ...resolveReportPresetRange(datePreset), datePreset });
  };

  return (
    <Card className="bg-white/85 shadow-soft">
      <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-6">
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
        <div className="space-y-2">
          <label className="text-sm font-medium text-brand-espresso">Group by</label>
          <Select
            value={filters.groupBy}
            onValueChange={(groupBy: FinancialReportGroupBy) => onChange({ ...filters, groupBy })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-brand-espresso">Source type</label>
          <Select
            value={filters.sourceType}
            onValueChange={(sourceType) => onChange({ ...filters, sourceType })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="pos_sale">POS sale</SelectItem>
              <SelectItem value="bakery_order">Bakery order</SelectItem>
              <SelectItem value="purchase_invoice">Purchase invoice</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-brand-espresso">Status</label>
          <Select
            value={filters.status}
            onValueChange={(status) => onChange({ ...filters, status })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-brand-espresso">Refund status</label>
          <Select
            value={filters.refundStatus}
            onValueChange={(refundStatus) => onChange({ ...filters, refundStatus })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All refunds</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
