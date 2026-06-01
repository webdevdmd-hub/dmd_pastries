"use client";

import { Download } from "lucide-react";
import type { JSX } from "react";
import { useMemo, useState } from "react";
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
import { useExportReportCsv, useReportBranches } from "@/hooks/use-reports";
import { getErrorMessage } from "@/lib/api/client";
import type { ExportReportSchema } from "@/lib/validators/reports.schema";
import type { ReportBaseFilters } from "@/types/reports";

function resolveTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dubai";
  } catch {
    return "Asia/Dubai";
  }
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ReportsExportClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const canView = hasAnyPermission([PERMISSIONS.reportsView]);
  const canExport = hasAnyPermission([PERMISSIONS.reportsExport]);
  const [dialogOpen, setDialogOpen] = useState(false);
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
  const exportCsvMutation = useExportReportCsv();
  const hasReportBranchScope =
    branchScope.canAccessAllBranches || Boolean(branchScope.effectiveBranchId);

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (!hasReportBranchScope) {
    return <NoBranchScopeCard />;
  }

  const handleExport = async (values: ExportReportSchema): Promise<void> => {
    if (!canExport) {
      toast.error("You need reports.export to export CSV files.");
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
      saveBlob(blob, `${values.reportType}-report-${filters.dateFrom}-to-${filters.dateTo}.csv`);
      toast.success("Report CSV exported.");
      setDialogOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <ReportPageHeader
        title="Export Center"
        description="Export report data as CSV for review, accounting, or backup."
        actions={
          <Button disabled={!canExport} type="button" onClick={() => setDialogOpen(true)}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />
      <Card className="bg-white/85 shadow-soft">
        <CardHeader>
          <CardTitle className="text-brand-espresso">CSV export foundation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-brand-mocha">
          <p>Supported backend report types for Sprint 5.1 are sales, payments, and orders.</p>
          <p>
            Inventory, manufacturing, and purchasing options are prepared in the UI for future
            report expansion and remain backend-dependent.
          </p>
          {!canExport ? <p>You need `reports.export` to export CSV files.</p> : null}
        </CardContent>
      </Card>
      <ExportHistoryPlaceholder />
      <ExportReportDialog
        branches={branchesQuery.data ?? []}
        canAccessAllBranches={branchScope.canAccessAllBranches}
        defaultFilters={defaultFilters}
        isSubmitting={exportCsvMutation.isPending}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleExport}
      />
    </div>
  );
}
