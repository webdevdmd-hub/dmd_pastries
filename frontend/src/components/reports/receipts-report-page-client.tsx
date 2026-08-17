"use client";

import { Eye, ReceiptText, Search } from "lucide-react";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { POSReceiptDialog } from "@/components/pos/pos-receipt-dialog";
import { AccessDeniedCard } from "@/components/reports/access-denied-card";
import { ReportBranchSelect } from "@/components/reports/report-branch-select";
import { ReportDateRangePicker } from "@/components/reports/report-date-range-picker";
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { ReportPresetSelector } from "@/components/reports/report-preset-selector";
import { formatCurrency, formatDate } from "@/components/reports/sales/sales-report-format";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PERMISSIONS } from "@/constants/permissions";
import { resolveReportPresetRange } from "@/constants/report-presets";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { usePermission } from "@/hooks/use-permission";
import { useReceiptRecords, useReportBranches, useSaleReceipt } from "@/hooks/use-reports";
import { useReceiptLayouts } from "@/hooks/use-settings-data";
import { getErrorMessage } from "@/lib/api/client";
import type { SaleReceipt } from "@/types/pos";
import type { ReceiptRecordRow, ReceiptRecordsFilters, ReportDatePreset } from "@/types/reports";
import type { ReceiptLayout } from "@/types/settings";

const allValue = "all";
const pageLimit = 25;

type ReceiptReportDraft = {
  branchId: string;
  cashierUserId: string;
  dateFrom: string;
  datePreset: ReportDatePreset;
  dateTo: string;
  paymentStatus: string;
  saleStatus: string;
  search: string;
};

function defaultReceiptReportDraft(branchId: string): ReceiptReportDraft {
  return {
    ...resolveReportPresetRange("this_month"),
    branchId,
    cashierUserId: "",
    datePreset: "this_month",
    paymentStatus: allValue,
    saleStatus: "completed",
    search: "",
  };
}

function toReceiptFilters(draft: ReceiptReportDraft, page = 1): ReceiptRecordsFilters {
  return {
    ...(draft.branchId ? { branchId: draft.branchId } : {}),
    ...(draft.cashierUserId ? { cashierUserId: draft.cashierUserId } : {}),
    dateFrom: draft.dateFrom,
    dateTo: draft.dateTo,
    limit: pageLimit,
    page,
    ...(draft.paymentStatus !== allValue ? { paymentStatus: draft.paymentStatus } : {}),
    ...(draft.saleStatus !== allValue ? { saleStatus: draft.saleStatus } : {}),
    ...(draft.search ? { search: draft.search } : {}),
    sortBy: "sold_at",
    sortOrder: "desc",
  };
}

function selectReceiptLayout(
  layouts: ReceiptLayout[],
  branchId: string | null,
): ReceiptLayout | null {
  const activeLayouts = layouts.filter((layout) => layout.status === "active");
  const branchLayouts = branchId
    ? activeLayouts.filter((layout) => layout.branchId === branchId)
    : [];
  const businessWideLayouts = activeLayouts.filter((layout) => layout.branchId === null);

  return (
    branchLayouts.find((layout) => layout.isDefault) ??
    branchLayouts.find((layout) => Boolean(layout.counterId ?? layout.printerType)) ??
    branchLayouts[0] ??
    businessWideLayouts.find((layout) => layout.isDefault) ??
    activeLayouts.find((layout) => layout.isDefault) ??
    activeLayouts[0] ??
    null
  );
}

function statusBadge(status: string): JSX.Element {
  const normalized = status.toLowerCase();
  if (normalized === "paid" || normalized === "completed" || normalized === "viewed") {
    return <Badge className="border-money/30 bg-money-tint text-money-text">{status}</Badge>;
  }
  if (normalized === "partial" || normalized === "pending" || normalized === "draft") {
    return <Badge className="border-warning/30 bg-warning-tint text-warning-text">{status}</Badge>;
  }
  return (
    <Badge className="border-danger/30 bg-danger-tint text-danger-text">
      {status || "unknown"}
    </Badge>
  );
}

function ReceiptsTable({
  isReceiptLoading,
  onViewReceipt,
  rows,
}: {
  isReceiptLoading: boolean;
  onViewReceipt: (row: ReceiptRecordRow) => void;
  rows: ReceiptRecordRow[];
}): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Sale / Bill</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Cashier</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Paid</TableHead>
          <TableHead>Payment</TableHead>
          <TableHead>Sale Status</TableHead>
          <TableHead>Sold At</TableHead>
          <TableHead>Views</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.saleId || `${row.saleNumber}-${row.soldAt}`}>
            <TableCell>
              <div className="font-semibold text-brand-espresso">{row.saleNumber || "-"}</div>
              <div className="text-xs text-brand-mocha">
                Receipt: {row.receiptStatus || "not viewed"}
              </div>
            </TableCell>
            <TableCell>{row.customerName || "Walk-in Customer"}</TableCell>
            <TableCell>{row.branchName || "-"}</TableCell>
            <TableCell>{row.cashierName || "-"}</TableCell>
            <TableCell>{formatCurrency(row.totalAmount)}</TableCell>
            <TableCell>{formatCurrency(row.paidAmount)}</TableCell>
            <TableCell>{statusBadge(row.paymentStatus)}</TableCell>
            <TableCell>{statusBadge(row.saleStatus)}</TableCell>
            <TableCell>{formatDate(row.soldAt)}</TableCell>
            <TableCell>
              <div>{row.viewCount}</div>
              {row.lastViewedAt ? (
                <div className="text-xs text-brand-mocha">Last: {formatDate(row.lastViewedAt)}</div>
              ) : null}
            </TableCell>
            <TableCell className="text-right">
              <Button
                disabled={isReceiptLoading || !row.saleId}
                size="sm"
                type="button"
                variant="outline"
                onClick={() => onViewReceipt(row)}
              >
                <Eye className="mr-2 h-4 w-4" />
                View receipt
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ReceiptsReportPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const canView = hasAnyPermission([PERMISSIONS.reportsView]);
  const hasScope = branchScope.canAccessAllBranches || Boolean(branchScope.effectiveBranchId);
  const initialDraft = useMemo(
    () => defaultReceiptReportDraft(branchScope.effectiveBranchId ?? ""),
    [branchScope.effectiveBranchId],
  );
  const [draft, setDraft] = useState<ReceiptReportDraft>(initialDraft);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(() => toReceiptFilters(initialDraft));
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);

  const branchesQuery = useReportBranches(canView && branchScope.canAccessAllBranches);
  const receiptsQuery = useReceiptRecords(filters, canView && hasScope);
  const saleReceiptMutation = useSaleReceipt();
  const receiptLayoutsQuery = useReceiptLayouts(canView && hasScope);
  const receiptLayout = useMemo(
    () => selectReceiptLayout(receiptLayoutsQuery.data ?? [], branchScope.effectiveBranchId),
    [branchScope.effectiveBranchId, receiptLayoutsQuery.data],
  );

  if (!canView) return <AccessDeniedCard />;
  if (!hasScope) return <NoBranchScopeCard />;

  const rows = receiptsQuery.data ?? [];
  const totalAmount = rows.reduce((total, row) => total + row.totalAmount, 0);
  const paidAmount = rows.reduce((total, row) => total + row.paidAmount, 0);
  const viewedCount = rows.filter((row) => row.viewCount > 0).length;

  const setPreset = (datePreset: ReportDatePreset): void => {
    if (datePreset === "custom") {
      setDraft((current) => ({ ...current, datePreset }));
      return;
    }
    setDraft((current) => ({ ...current, ...resolveReportPresetRange(datePreset), datePreset }));
  };

  const applyFilters = (): void => {
    setPage(1);
    setFilters(toReceiptFilters(draft, 1));
  };

  const resetFilters = (): void => {
    setDraft(initialDraft);
    setPage(1);
    setFilters(toReceiptFilters(initialDraft, 1));
  };

  const changePage = (nextPage: number): void => {
    setPage(nextPage);
    setFilters(toReceiptFilters(draft, nextPage));
  };

  const viewReceipt = (row: ReceiptRecordRow): void => {
    void saleReceiptMutation
      .mutateAsync(row.saleId)
      .then((nextReceipt) => {
        setReceipt(nextReceipt);
        setReceiptOpen(true);
      })
      .catch((error: unknown) => {
        toast.error(getErrorMessage(error));
      });
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <ReportPageHeader
        title="Sales Receipts"
        description="Review completed POS sales, receipt view history, payment status, and printable bill details."
      />

      <Card className="bg-card/85 shadow-soft">
        <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-6">
          <ReportPresetSelector value={draft.datePreset} onChange={setPreset} />
          <ReportDateRangePicker
            dateFrom={draft.dateFrom}
            dateTo={draft.dateTo}
            onDateFromChange={(dateFrom) =>
              setDraft((current) => ({ ...current, dateFrom, datePreset: "custom" }))
            }
            onDateToChange={(dateTo) =>
              setDraft((current) => ({ ...current, dateTo, datePreset: "custom" }))
            }
          />
          <ReportBranchSelect
            branches={branchesQuery.data ?? []}
            canAccessAllBranches={branchScope.canAccessAllBranches}
            currentBranchId={branchScope.effectiveBranchId}
            value={draft.branchId}
            onChange={(branchId) => setDraft((current) => ({ ...current, branchId }))}
          />
          <div className="space-y-2">
            <label className="text-sm font-medium text-brand-espresso" htmlFor="receipt-search">
              Search sale / customer
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mocha" />
              <Input
                className="pl-9"
                id="receipt-search"
                placeholder="SALE number or customer"
                value={draft.search}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, search: event.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-brand-espresso">Payment status</label>
            <Select
              value={draft.paymentStatus}
              onValueChange={(paymentStatus) =>
                setDraft((current) => ({ ...current, paymentStatus }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All payments</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-brand-espresso">Sale status</label>
            <Select
              value={draft.saleStatus}
              onValueChange={(saleStatus) => setDraft((current) => ({ ...current, saleStatus }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="voided">Voided</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2 xl:col-span-6">
            <Button type="button" onClick={applyFilters}>
              Apply
            </Button>
            <Button type="button" variant="outline" onClick={resetFilters}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card/85 shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-brand-mocha">Receipts in view</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end gap-2">
            <ReceiptText className="mb-1 h-5 w-5 text-brand-caramel" />
            <span className="text-3xl font-medium text-brand-espresso">{rows.length}</span>
          </CardContent>
        </Card>
        <Card className="bg-card/85 shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-brand-mocha">Total billed</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-medium text-brand-espresso">
            {formatCurrency(totalAmount)}
          </CardContent>
        </Card>
        <Card className="bg-card/85 shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-brand-mocha">Viewed receipts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-medium text-brand-espresso">{viewedCount}</div>
            <p className="text-sm text-brand-mocha">Paid total: {formatCurrency(paidAmount)}</p>
          </CardContent>
        </Card>
      </div>

      {receiptsQuery.error ? (
        <Card className="border-danger/30 bg-danger-tint text-danger-text">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <p>{getErrorMessage(receiptsQuery.error)}</p>
            <Button type="button" variant="outline" onClick={() => void receiptsQuery.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="bg-card/85 shadow-soft">
        <CardContent className="overflow-x-auto p-5">
          {receiptsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  className="h-14 animate-pulse rounded-2xl bg-brand-cappuccino/35"
                  key={String(index)}
                />
              ))}
            </div>
          ) : rows.length > 0 ? (
            <ReceiptsTable
              isReceiptLoading={saleReceiptMutation.isPending}
              rows={rows}
              onViewReceipt={viewReceipt}
            />
          ) : (
            <div className="flex min-h-44 flex-col items-center justify-center gap-3 text-center">
              <ReceiptText className="h-10 w-10 text-brand-caramel" />
              <div>
                <h2 className="text-xl font-bold text-brand-espresso">No receipts found</h2>
                <p className="text-brand-mocha">
                  Completed POS sales will appear here with their saved receipt details.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          disabled={page <= 1 || receiptsQuery.isFetching}
          type="button"
          variant="outline"
          onClick={() => changePage(Math.max(1, page - 1))}
        >
          Previous
        </Button>
        <Button
          disabled={rows.length < pageLimit || receiptsQuery.isFetching}
          type="button"
          variant="outline"
          onClick={() => changePage(page + 1)}
        >
          Next
        </Button>
      </div>

      <POSReceiptDialog
        layout={receiptLayout}
        open={receiptOpen}
        primaryActionLabel="Close"
        receipt={receipt}
        onNewSale={() => setReceiptOpen(false)}
        onOpenChange={setReceiptOpen}
      />
    </div>
  );
}
