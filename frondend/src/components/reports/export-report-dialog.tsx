"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Download, LoaderCircle } from "lucide-react";
import type { JSX } from "react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

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
import { exportReportTypes } from "@/constants/report-presets";
import { type ExportReportSchema, exportReportSchema } from "@/lib/validators/reports.schema";
import type { Branch } from "@/types/branch";
import type { ReportBaseFilters, ReportType } from "@/types/reports";

type ExportReportDialogProps = {
  branches: Branch[];
  canAccessAllBranches: boolean;
  defaultFilters: ReportBaseFilters;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ExportReportSchema) => Promise<void>;
  open: boolean;
};

export function ExportReportDialog({
  branches,
  canAccessAllBranches,
  defaultFilters,
  isSubmitting,
  onOpenChange,
  onSubmit,
  open,
}: ExportReportDialogProps): JSX.Element {
  const form = useForm<ExportReportSchema>({
    defaultValues: {
      filters: defaultFilters,
      reportType: "sales",
    },
    resolver: zodResolver(exportReportSchema),
  });

  useEffect(() => {
    if (open) {
      form.reset({
        filters: defaultFilters,
        reportType: "sales",
      });
    }
  }, [defaultFilters, form, open]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export report CSV</DialogTitle>
          <DialogDescription>
            Export branch-safe report data for accounting, review, or backup workflows.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-brand-espresso">Report type</label>
            <Select
              value={form.watch("reportType")}
              onValueChange={(value: ReportType) => form.setValue("reportType", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {exportReportTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-brand-espresso">Branch</label>
            <Select
              value={form.watch("filters.branchId") ?? ""}
              onValueChange={(branchId) => form.setValue("filters.branchId", branchId)}
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
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-brand-espresso" htmlFor="export-date-from">
              Date from
            </label>
            <Input id="export-date-from" type="date" {...form.register("filters.dateFrom")} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-brand-espresso" htmlFor="export-date-to">
              Date to
            </label>
            <Input id="export-date-to" type="date" {...form.register("filters.dateTo")} />
          </div>
          {form.formState.errors.filters?.dateTo ? (
            <p className="md:col-span-2 text-sm text-red-700">
              {form.formState.errors.filters.dateTo.message}
            </p>
          ) : null}
          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export CSV
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
