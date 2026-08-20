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
import type {
  BakeryOrdersReportFilters,
  BakeryOrdersReportGroupBy,
} from "@/types/bakery-orders-reports";
import type { Branch } from "@/types/branch";
import type { ReportDatePreset } from "@/types/reports";

const allValue = "all";

export type BakeryOrdersReportStatusOption = {
  label: string;
  value: string;
};

const defaultOrderStatusOptions: BakeryOrdersReportStatusOption[] = [
  { label: "New", value: "new" },
  { label: "Confirmed", value: "confirmed" },
  { label: "In production", value: "in_production" },
  { label: "Ready", value: "ready" },
  { label: "Delivered", value: "delivered" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

const defaultPaymentStatusOptions: BakeryOrdersReportStatusOption[] = [
  { label: "All payments", value: allValue },
  { label: "Unpaid", value: "unpaid" },
  { label: "Partial", value: "partial" },
  { label: "Paid", value: "paid" },
];

export type BakeryOrdersReportFilterDraft = {
  branchId: string;
  customerId: string;
  dateFrom: string;
  datePreset: ReportDatePreset;
  dateTo: string;
  groupBy: BakeryOrdersReportGroupBy;
  orderStatus: string;
  orderType: "all" | "pickup" | "delivery";
  paymentStatus: string;
};

export function toBakeryOrdersReportFilters(
  filters: BakeryOrdersReportFilterDraft,
): BakeryOrdersReportFilters {
  return {
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    groupBy: filters.groupBy,
    ...(filters.orderStatus !== allValue ? { orderStatus: filters.orderStatus } : {}),
    ...(filters.orderType !== allValue ? { orderType: filters.orderType } : {}),
    ...(filters.paymentStatus !== allValue ? { paymentStatus: filters.paymentStatus } : {}),
  };
}

export function BakeryOrdersReportFilterBar({
  branches,
  canAccessAllBranches,
  currentBranchId,
  defaultFilters,
  filters,
  onApply,
  onChange,
  onReset,
  orderStatusAllLabel = "All statuses",
  orderStatusOptions = defaultOrderStatusOptions,
  paymentStatusOptions = defaultPaymentStatusOptions,
}: {
  branches: Branch[];
  canAccessAllBranches: boolean;
  currentBranchId: string | null;
  defaultFilters: BakeryOrdersReportFilterDraft;
  filters: BakeryOrdersReportFilterDraft;
  onApply: () => void;
  onChange: (filters: BakeryOrdersReportFilterDraft) => void;
  onReset: () => void;
  orderStatusAllLabel?: string;
  orderStatusOptions?: BakeryOrdersReportStatusOption[];
  paymentStatusOptions?: BakeryOrdersReportStatusOption[];
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
            htmlFor="bakery-report-customer"
          >
            Customer ID
          </label>
          <Input
            id="bakery-report-customer"
            placeholder="Optional customer UUID"
            value={filters.customerId}
            onChange={(event) => onChange({ ...filters, customerId: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="bakery-orders-report-filter-bar-order-type"
            className="text-sm font-medium text-brand-espresso"
          >
            Order type
          </label>
          <Select
            value={filters.orderType}
            onValueChange={(orderType: BakeryOrdersReportFilterDraft["orderType"]) =>
              onChange({ ...filters, orderType })
            }
          >
            <SelectTrigger id="bakery-orders-report-filter-bar-order-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="pickup">Pickup</SelectItem>
              <SelectItem value="delivery">Delivery</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label
            htmlFor="bakery-orders-report-filter-bar-group-by"
            className="text-sm font-medium text-brand-espresso"
          >
            Group by
          </label>
          <Select
            value={filters.groupBy}
            onValueChange={(groupBy: BakeryOrdersReportGroupBy) =>
              onChange({ ...filters, groupBy })
            }
          >
            <SelectTrigger id="bakery-orders-report-filter-bar-group-by">
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
          <label
            htmlFor="bakery-orders-report-filter-bar-order-status"
            className="text-sm font-medium text-brand-espresso"
          >
            Order status
          </label>
          <Select
            value={filters.orderStatus}
            onValueChange={(orderStatus) => onChange({ ...filters, orderStatus })}
          >
            <SelectTrigger id="bakery-orders-report-filter-bar-order-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{orderStatusAllLabel}</SelectItem>
              {orderStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label
            htmlFor="bakery-orders-report-filter-bar-payment-status"
            className="text-sm font-medium text-brand-espresso"
          >
            Payment status
          </label>
          <Select
            value={filters.paymentStatus}
            onValueChange={(paymentStatus) => onChange({ ...filters, paymentStatus })}
          >
            <SelectTrigger id="bakery-orders-report-filter-bar-payment-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paymentStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
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
