"use client";

import { Download } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/reports/access-denied-card";
import { ExportHistoryPlaceholder } from "@/components/reports/export-history-placeholder";
import { ExportReportDialog } from "@/components/reports/export-report-dialog";
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { resolveReportPresetRange } from "@/constants/report-presets";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { usePermission } from "@/hooks/use-permission";
import { useExportReportCsv, useReportBranches, useReportExportOptions } from "@/hooks/use-reports";
import { getErrorMessage } from "@/lib/api/client";
import type { ExportReportSchema } from "@/lib/validators/reports.schema";
import type { ReportBaseFilters } from "@/types/reports";

type ExportDownloadState = {
  filename: string;
  url: string;
};

function resolveTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dubai";
  } catch {
    return "Asia/Dubai";
  }
}

function triggerDownload(url: string, filename: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

export function ReportsExportClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const canView = hasAnyPermission([PERMISSIONS.reportsView]);
  const canExport = hasAnyPermission([PERMISSIONS.reportsExport]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [latestDownload, setLatestDownload] = useState<ExportDownloadState | null>(null);
  const [selectedReportType, setSelectedReportType] = useState("");
  const timezone = useMemo(resolveTimezone, []);
  const defaultFilters = useMemo<ReportBaseFilters>(() => {
    const range = resolveReportPresetRange("this_month");

    return {
      ...range,
      groupBy: "day",
      scope: "current_branch",
      timezone,
      ...(branchScope.effectiveBranchId ? { branchId: branchScope.effectiveBranchId } : {}),
    };
  }, [branchScope.effectiveBranchId, timezone]);
  const branchesQuery = useReportBranches(canView && branchScope.canAccessAllBranches);
  const exportOptionsQuery = useReportExportOptions(canView && canExport);
  const exportCsvMutation = useExportReportCsv();
  const hasReportBranchScope =
    branchScope.canAccessAllBranches || Boolean(branchScope.effectiveBranchId);
  const exportOptions = exportOptionsQuery.data ?? [];
  const selectedExportOption = exportOptions.find(
    (option) => option.reportType === selectedReportType && option.supported,
  );
  const firstSupportedOption = exportOptions.find((option) => option.supported);

  useEffect(() => {
    return () => {
      if (latestDownload) {
        URL.revokeObjectURL(latestDownload.url);
      }
    };
  }, [latestDownload]);

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (!hasReportBranchScope) {
    return <NoBranchScopeCard />;
  }

  const clearExportStatus = (): void => {
    setExportError(null);
    setLatestDownload((current) => {
      if (current) {
        URL.revokeObjectURL(current.url);
      }

      return null;
    });
  };

  const handleDialogOpenChange = (open: boolean): void => {
    if (!open && exportCsvMutation.isPending) {
      return;
    }

    setDialogOpen(open);

    if (!open) {
      clearExportStatus();
    }
  };

  const handleExport = async (values: ExportReportSchema): Promise<void> => {
    clearExportStatus();

    if (!canExport) {
      const message = "You need reports.export to export CSV files.";

      setExportError(message);
      toast.error(message);
      return;
    }

    try {
      const filters: ReportBaseFilters = {
        dateFrom: values.filters.dateFrom,
        dateTo: values.filters.dateTo,
        ...(values.filters.groupBy ? { groupBy: values.filters.groupBy } : {}),
        ...(values.filters.timezone ? { timezone: values.filters.timezone } : {}),
        ...(values.filters.branchId === "all"
          ? { branchId: "all", scope: "all_branches" as const }
          : {
              scope: "current_branch" as const,
              ...(values.filters.branchId ? { branchId: values.filters.branchId } : {}),
            }),
      };
      const blob = await exportCsvMutation.mutateAsync({
        filters,
        reportType: values.reportType,
      });
      const url = URL.createObjectURL(blob.blob);

      setLatestDownload({ filename: blob.filename, url });
      triggerDownload(url, blob.filename);
      toast.success(`${selectedExportOption?.label ?? "Report"} CSV export started: ${blob.filename}`);
    } catch (error) {
      const message = getErrorMessage(error);

      setExportError(message);
      toast.error(message);
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <ReportPageHeader
        title="Export Center"
        description="Export report data as CSV for review, accounting, or backup."
        actions={
          <Button
            disabled={!canExport || exportOptionsQuery.isLoading}
            type="button"
            onClick={() => {
              if (!selectedReportType && firstSupportedOption) {
                setSelectedReportType(firstSupportedOption.reportType);
              }
              clearExportStatus();
              setDialogOpen(true);
            }}
          >
            <Download className="h-4 w-4" />
            {selectedExportOption ? `Export ${selectedExportOption.label} CSV` : "Select report to export"}
          </Button>
        }
      />
      <Card className="bg-white/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-brand-espresso">Available CSV exports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-brand-mocha">
          <p>
            Select a report type to preview the date range, branch scope, and CSV file name before
            downloading.
          </p>
          <p>
            Inventory, Manufacturing, Bakery Orders, Financial, Sales, Payments, and Orders exports
            are shown from backend availability.
          </p>
          {exportOptionsQuery.error ? (
            <p className="font-medium text-red-700">{getErrorMessage(exportOptionsQuery.error)}</p>
          ) : null}
          {!canExport ? <p>You need `reports.export` to export CSV files.</p> : null}
        </CardContent>
      </Card>
      <ExportHistoryPlaceholder />
      <ExportReportDialog
        branches={branchesQuery.data ?? []}
        canAccessAllBranches={branchScope.canAccessAllBranches}
        defaultFilters={defaultFilters}
        defaultReportType={
          selectedReportType ? selectedReportType : (firstSupportedOption?.reportType ?? "")
        }
        exportOptions={exportOptions}
        exportError={exportError}
        isSubmitting={exportCsvMutation.isPending}
        latestDownload={latestDownload}
        open={dialogOpen}
        onDownloadAgain={() => {
          if (latestDownload) {
            triggerDownload(latestDownload.url, latestDownload.filename);
          }
        }}
        onInputChange={clearExportStatus}
        onOpenChange={handleDialogOpenChange}
        onReportTypeChange={setSelectedReportType}
        onSubmit={handleExport}
      />
    </div>
  );
}
