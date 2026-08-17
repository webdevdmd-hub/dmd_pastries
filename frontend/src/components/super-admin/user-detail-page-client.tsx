"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { LoadingState } from "@/components/shared/loading-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { useSuperAdminBusiness, useSuperAdminUser } from "@/hooks/use-super-admin";
import { getErrorMessage } from "@/lib/api/client";

import { formatCount, formatDateTime } from "./format";
import { StatusBadge } from "./status-badge";
import { SuperAdminUserActionPanel } from "./user-action-panel";

type UserDetailPageClientProps = {
  userId: string;
};

export function SuperAdminUserDetailPageClient({ userId }: UserDetailPageClientProps): JSX.Element {
  const userQuery = useSuperAdminUser(userId);
  const detail = userQuery.data;
  const businessQuery = useSuperAdminBusiness(detail?.user.businessId ?? "");

  if (userQuery.isLoading) {
    return <LoadingState />;
  }

  if (userQuery.error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load user</AlertTitle>
        <AlertDescription>{getErrorMessage(userQuery.error)}</AlertDescription>
      </Alert>
    );
  }

  if (!detail) {
    return <Alert>No user data available.</Alert>;
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold text-foreground-muted">User 360</p>
          <h2 className="mt-1 text-2xl font-semibold text-brand-espresso">
            {detail.user.fullName}
          </h2>
          <p className="mt-2 text-sm text-foreground-muted">{detail.user.email}</p>
        </div>
        <StatusBadge status={detail.user.status} />
      </section>

      {detail.warnings.length > 0 ? (
        <Alert className="border-warning/30 bg-warning-tint text-warning-text">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>User warnings</AlertTitle>
          <AlertDescription>
            {detail.warnings.map((warning) => warning.summary).join(" ")}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-4">
        <MetricCard label="Role" value={detail.user.roleName} />
        <MetricCard label="Branch" value={detail.user.branchName ?? "No branch"} />
        <MetricCard label="Permissions" value={formatCount(detail.permissions.length)} />
        <MetricCard label="Related rows" value={formatCount(totalRelatedRows(detail))} />
      </div>

      <SuperAdminUserActionPanel detail={detail} business={businessQuery.data} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border shadow-none">
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <KeyValue label="User ID" value={detail.user.id} />
            <KeyValue label="Appwrite ID" value={detail.user.appwriteUserId} />
            <KeyValue label="Phone" value={detail.user.phone || "Not set"} />
            <KeyValue label="Email verified" value={detail.user.emailVerified ? "Yes" : "No"} />
            <KeyValue label="Last login" value={formatDateTime(detail.user.lastLoginAt)} />
          </CardContent>
        </Card>

        <Card className="border-border shadow-none">
          <CardHeader>
            <CardTitle>Tenant Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <KeyValue
              label="Business"
              value={
                <Link
                  className="font-medium text-brand-caramel hover:underline"
                  href={`${ROUTES.superAdmin}/businesses/${detail.user.businessId}`}
                >
                  {detail.user.businessName}
                </Link>
              }
            />
            <KeyValue
              label="Can access all branches"
              value={detail.user.canAccessAllBranches ? "Yes" : "No"}
            />
            <KeyValue label="Assigned branch" value={detail.user.branchName ?? "No branch"} />
            <KeyValue label="Current branch ID" value={detail.user.currentBranchId ?? "Not set"} />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border shadow-none">
        <CardHeader>
          <CardTitle>Related Data Counts</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {detail.relatedDataCounts.map((item) => (
            <div
              className="rounded-md border border-border bg-card p-3"
              key={`${item.module}-${item.table}`}
            >
              <p className="text-sm font-semibold text-brand-espresso">{item.module}</p>
              <p className="mt-1 font-mono text-xs text-foreground-muted">{item.table}</p>
              <p className="mt-3 text-2xl font-semibold">{formatCount(item.count)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border shadow-none">
          <CardHeader>
            <CardTitle>Branch Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.branchAccess.length === 0 ? (
              <p className="text-sm text-foreground-muted">No explicit branch access records.</p>
            ) : null}
            {detail.branchAccess.map((branch) => (
              <div
                className="flex items-center justify-between gap-3 border-b border-border pb-3"
                key={branch.id}
              >
                <div>
                  <p className="font-medium">{branch.branchName}</p>
                  <p className="text-xs text-foreground-muted">{branch.code}</p>
                </div>
                <StatusBadge status={branch.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border shadow-none">
          <CardHeader>
            <CardTitle>Permissions Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="flex max-h-72 flex-wrap gap-2 overflow-auto">
            {detail.permissions.map((permission) => (
              <Badge
                className="border-border bg-muted text-foreground-muted"
                key={permission}
                variant="outline"
              >
                {permission}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border shadow-none">
        <CardHeader>
          <CardTitle>Recent Audit Events</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.auditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{log.eventType}</TableCell>
                  <TableCell>
                    {log.entityType} / {log.entityId}
                  </TableCell>
                  <TableCell>{log.summary || "No summary"}</TableCell>
                  <TableCell>{formatDateTime(log.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function totalRelatedRows(detail: { relatedDataCounts: { count: number }[] }): number {
  return detail.relatedDataCounts.reduce((total, item) => total + item.count, 0);
}

function MetricCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <Card className="border-border shadow-none">
      <CardContent className="p-4">
        <p className="text-xs font-semibold text-foreground-muted">{label}</p>
        <p className="mt-2 truncate text-xl font-semibold text-brand-espresso">{value}</p>
      </CardContent>
    </Card>
  );
}

function KeyValue({ label, value }: { label: string; value: JSX.Element | string }): JSX.Element {
  return (
    <div>
      <p className="text-xs font-semibold text-foreground-muted">{label}</p>
      <div className="mt-1 break-all text-brand-espresso">{value}</div>
    </div>
  );
}
