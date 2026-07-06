"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Download, LoaderCircle } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type ExportReportSchema, exportReportSchema } from "@/lib/validators/reports.schema";
import type { Branch } from "@/types/branch";
import type { ReportBaseFilters, ReportExportOption, ReportType } from "@/types/reports";

type ExportReportDialogProps = {
  branches: Branch[];
  canAccessAllBranches: boolean;
  defaultFilters: ReportBaseFilters;
  defaultReportType: ReportType;
  exportError: string | null;
  exportOptions: ReportExportOption[];
  isSubmitting: boolean;
  latestDownload: {
    filename: string;
    url: string;
  } | null;
  onDownloadAgain: () => void;
  onInputChange: () => void;
  onOpenChange: (open: boolean) => void;
  onReportTypeChange: (reportType: ReportType) => void;
  onSubmit: (values: ExportReportSchema) => Promise<void>;
  open: boolean;
};

function firstSupportedReport(
  options: ReportExportOption[],
  preferredReportType: ReportType,
): ReportExportOption | undefined {
  return (
    options.find((option) => option.reportType === preferredReportType && option.supported) ??
    options.find((option) => option.supported)
  );
}

export function ExportReportDialog({
  branches,
  canAccessAllBranches,
  defaultFilters,
  defaultReportType,
  exportError,
  exportOptions,
  isSubmitting,
  latestDownload,
  onDownloadAgain,
  onInputChange,
  onOpenChange,
  onReportTypeChange,
  onSubmit,
  open,
}: ExportReportDialogProps): JSX.Element {
  const initialReport = firstSupportedReport(exportOptions, defaultReportType);
  const form = useForm<ExportReportSchema>({
    defaultValues: {
      filters: defaultFilters,
      reportType: initialReport?.reportType ?? defaultReportType,
    },
    resolver: zodResolver(exportReportSchema),
  });
  const categories = useMemo(
    () => Array.from(new Set(exportOptions.map((option) => option.category).filter(Boolean))),
    [exportOptions],
  );
  const selectedReportType = form.watch("reportType");
  const selectedOption = exportOptions.find((option) => option.reportType === selectedReportType);
  const [selectedCategory, setSelectedCategory] = useState(
    selectedOption?.category ?? categories[0] ?? "",
  );
  const visibleOptions = exportOptions.filter((option) => option.category === selectedCategory);
  const selectedBranchId = form.watch("filters.branchId");
  const selectedBranch =
    selectedBranchId && selectedBranchId !== "all"
      ? branches.find((branch) => branch.id === selectedBranchId)
      : null;
  const branchLabel =
    selectedBranchId === "all"
      ? "All branches"
      : selectedBranch
        ? `${selectedBranch.name} (${selectedBranch.code})`
        : "Current branch";
  const dateFrom = form.watch("filters.dateFrom");
  const dateTo = form.watch("filters.dateTo");
  const previewFilename = selectedOption
    ? `${selectedOption.reportType}-${dateFrom}-to-${dateTo}.csv`
    : "";

  useEffect(() => {
    if (!open) {
      return;
    }
    const nextReport = firstSupportedReport(exportOptions, defaultReportType);
    const nextReportType = nextReport?.reportType ?? defaultReportType;
    form.reset({
      filters: defaultFilters,
      reportType: nextReportType,
    });
    setSelectedCategory(nextReport?.category ?? categories[0] ?? "");
  }, [categories, defaultFilters, defaultReportType, exportOptions, form, open]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });
  const dateFromField = form.register("filters.dateFrom");
  const dateToField = form.register("filters.dateTo");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export report CSV</DialogTitle>
          <DialogDescription>
            Select a report and confirm the branch/date scope before downloading CSV data.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-brand-espresso">Category</label>
            <Select
              disabled={isSubmitting}
              value={selectedCategory}
              onValueChange={(value) => {
                onInputChange();
                setSelectedCategory(value);
                const nextReport = exportOptions.find(
                  (option) => option.category === value && option.supported,
                );
                if (nextReport) {
                  form.setValue("reportType", nextReport.reportType, { shouldValidate: true });
                  onReportTypeChange(nextReport.reportType);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-brand-espresso">Report type</label>
            <Select
              disabled={isSubmitting}
              value={selectedReportType}
              onValueChange={(value: ReportType) => {
                onInputChange();
                form.setValue("reportType", value, { shouldValidate: true });
                onReportTypeChange(value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select report" />
              </SelectTrigger>
              <SelectContent>
                {visibleOptions.map((option) => (
                  <SelectItem
                    disabled={!option.supported}
                    key={option.reportType}
                    value={option.reportType}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedOption && !selectedOption.supported ? (
              <p className="text-xs font-medium text-red-700">{selectedOption.unsupportedReason}</p>
            ) : null}
            {form.formState.errors.reportType ? (
              <p className="text-xs font-medium text-red-700">
                {form.formState.errors.reportType.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-brand-espresso">Branch</label>
            <Select
              disabled={isSubmitting}
              value={selectedBranchId ?? ""}
              onValueChange={(branchId) => {
                onInputChange();
                form.setValue("filters.branchId", branchId, { shouldValidate: true });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Current branch" />
              </SelectTrigger>
              <SelectContent>
                {canAccessAllBranches ? <SelectItem value="all">All branches</SelectItem> : null}
                {branches
                  .filter((branch) => branch.status === "active")
                  .map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name} ({branch.code})
                    </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.filters?.branchId ? (
              <p className="text-xs font-medium text-red-700">
                {form.formState.errors.filters.branchId.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-brand-espresso" htmlFor="export-date-from">
              Date from
            </label>
            <Input
              id="export-date-from"
              type="date"
              {...dateFromField}
              disabled={isSubmitting}
              onChange={(event) => {
                onInputChange();
                void dateFromField.onChange(event);
              }}
            />
            {form.formState.errors.filters?.dateFrom ? (
              <p className="text-xs font-medium text-red-700">
                {form.formState.errors.filters.dateFrom.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-brand-espresso" htmlFor="export-date-to">
              Date to
            </label>
            <Input
              id="export-date-to"
              type="date"
              {...dateToField}
              disabled={isSubmitting}
              onChange={(event) => {
                onInputChange();
                void dateToField.onChange(event);
              }}
            />
          </div>
          {form.formState.errors.filters?.dateTo ? (
            <p className="md:col-span-2 text-sm text-red-700">
              {form.formState.errors.filters.dateTo.message}
            </p>
          ) : null}
          <div className="md:col-span-2 rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-4 text-sm text-brand-mocha">
            <p className="font-semibold text-brand-espresso">Export preview</p>
            <dl className="mt-3 grid gap-2 md:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-mocha/70">
                  Report
                </dt>
                <dd>{selectedOption?.label ?? "Select a report"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-mocha/70">
                  Category
                </dt>
                <dd>{selectedOption?.category ?? selectedCategory}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-mocha/70">
                  Date range
                </dt>
                <dd>
                  {dateFrom} to {dateTo}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-mocha/70">
                  Branch
                </dt>
                <dd>{branchLabel}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-mocha/70">
                  File
                </dt>
                <dd className="break-all font-mono text-xs">{previewFilename}</dd>
              </div>
            </dl>
            {selectedOption?.description ? <p className="mt-3">{selectedOption.description}</p> : null}
          </div>
          {exportError ? (
            <Alert className="md:col-span-2 border-red-200 bg-red-50 text-red-950">
              <AlertTitle>Export failed</AlertTitle>
              <AlertDescription>{exportError}</AlertDescription>
            </Alert>
          ) : null}
          {latestDownload ? (
            <Alert className="md:col-span-2 border-emerald-200 bg-emerald-50 text-emerald-950">
              <AlertTitle>Export ready</AlertTitle>
              <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="break-all">
                  Download started for <span className="font-mono">{latestDownload.filename}</span>.
                </span>
                <Button type="button" variant="outline" onClick={onDownloadAgain}>
                  <Download className="h-4 w-4" />
                  Download again
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter className="md:col-span-2">
            <Button
              disabled={isSubmitting}
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button disabled={isSubmitting || !selectedOption?.supported} type="submit">
              {isSubmitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {selectedOption ? `Export ${selectedOption.label} CSV` : "Export CSV"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
