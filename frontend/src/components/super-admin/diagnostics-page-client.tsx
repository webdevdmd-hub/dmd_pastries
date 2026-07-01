"use client";

import { AlertTriangle, Building2, RefreshCw, UserRound } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { LoadingState } from "@/components/shared/loading-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import { useSuperAdminDiagnostics } from "@/hooks/use-super-admin";
import { getErrorMessage } from "@/lib/api/client";

import { StatusBadge } from "./status-badge";

export function SuperAdminDiagnosticsPageClient(): JSX.Element {
  const diagnosticsQuery = useSuperAdminDiagnostics();
  const diagnostics = diagnosticsQuery.data ?? [];
  const criticalCount = diagnostics.filter((item) => item.severity === "critical").length;
  const warningCount = diagnostics.filter((item) => item.severity === "warning").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            Platform Health
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-brand-espresso">Diagnostics</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
            Review tenant and access issues that commonly break login, branch routing, and role
            permissions.
          </p>
        </div>
        <Button
          onClick={() => {
            void diagnosticsQuery.refetch();
          }}
          type="button"
          variant="outline"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Open issues" value={diagnostics.length} />
        <MetricCard label="Critical" value={criticalCount} />
        <MetricCard label="Warnings" value={warningCount} />
      </div>

      {diagnosticsQuery.isLoading ? <LoadingState /> : null}

      {diagnosticsQuery.error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load diagnostics</AlertTitle>
          <AlertDescription>{getErrorMessage(diagnosticsQuery.error)}</AlertDescription>
        </Alert>
      ) : null}

      {diagnosticsQuery.data ? (
        <Card className="border-stone-300 shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" />
              Findings
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diagnostics.length > 0 ? (
                  diagnostics.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <StatusBadge status={item.severity} />
                      </TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell>{item.summary}</TableCell>
                      <TableCell>
                        {item.businessId ? (
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`${ROUTES.superAdmin}/businesses/${item.businessId}`}>
                              <Building2 className="h-4 w-4" />
                              Open
                            </Link>
                          </Button>
                        ) : (
                          <span className="text-stone-500">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.userId ? (
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`${ROUTES.superAdmin}/users/${item.userId}`}>
                              <UserRound className="h-4 w-4" />
                              Open
                            </Link>
                          </Button>
                        ) : (
                          <span className="text-stone-500">None</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell className="py-8 text-center text-stone-500" colSpan={5}>
                      No diagnostics found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <Card className="border-stone-300 shadow-none">
      <CardContent className="p-5">
        <p className="text-sm text-stone-500">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-brand-espresso">{value}</p>
      </CardContent>
    </Card>
  );
}
