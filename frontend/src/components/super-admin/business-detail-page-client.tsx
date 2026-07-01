"use client";

import { AlertTriangle, Eye } from "lucide-react";
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
import { useSuperAdminBusiness } from "@/hooks/use-super-admin";
import { getErrorMessage } from "@/lib/api/client";

import { SuperAdminBusinessActionPanel } from "./business-action-panel";
import { formatCount, formatDateTime } from "./format";
import { StatusBadge } from "./status-badge";

type BusinessDetailPageClientProps = {
  businessId: string;
};

export function SuperAdminBusinessDetailPageClient({
  businessId,
}: BusinessDetailPageClientProps): JSX.Element {
  const businessQuery = useSuperAdminBusiness(businessId);
  const detail = businessQuery.data;

  if (businessQuery.isLoading) {
    return <LoadingState />;
  }

  if (businessQuery.error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load business</AlertTitle>
        <AlertDescription>{getErrorMessage(businessQuery.error)}</AlertDescription>
      </Alert>
    );
  }

  if (!detail) {
    return <Alert>No business data available.</Alert>;
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b border-stone-300 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            Business Detail
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-brand-espresso">
            {detail.business.businessName}
          </h2>
          <p className="mt-2 text-sm text-stone-600">{detail.business.id}</p>
        </div>
        <StatusBadge status={detail.business.status} />
      </section>

      {detail.warnings.length > 0 ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Setup warnings</AlertTitle>
          <AlertDescription>
            {detail.warnings.map((warning) => warning.summary).join(" ")}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-4">
        <MetricCard label="Users" value={formatCount(detail.business.usersCount)} />
        <MetricCard label="Branches" value={formatCount(detail.business.branchesCount)} />
        <MetricCard label="Roles" value={formatCount(detail.business.rolesCount)} />
        <MetricCard
          label="Subscription"
          value={detail.subscription?.status ?? detail.business.subscriptionStatus ?? "Missing"}
        />
      </div>

      <SuperAdminBusinessActionPanel detail={detail} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-stone-300 shadow-none">
          <CardHeader>
            <CardTitle>Owner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{detail.business.ownerName ?? "No owner assigned"}</p>
            <p className="text-stone-500">{detail.business.ownerEmail ?? "No owner email"}</p>
            <p className="text-stone-500">Created {formatDateTime(detail.business.createdAt)}</p>
          </CardContent>
        </Card>

        <Card className="border-stone-300 shadow-none">
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Status: {detail.subscription?.status ?? "Missing"}</p>
            <p>Plan: {detail.subscription?.planType ?? "Missing"}</p>
            <p>
              Limits: {detail.subscription?.userLimit ?? 0} users,{" "}
              {detail.subscription?.branchLimit ?? 0} branches
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-stone-300 shadow-none">
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <p className="font-medium">{user.fullName}</p>
                    <p className="text-xs text-stone-500">{user.email}</p>
                  </TableCell>
                  <TableCell>{user.roleName}</TableCell>
                  <TableCell>{user.branchName ?? "No branch"}</TableCell>
                  <TableCell>
                    <StatusBadge status={user.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`${ROUTES.superAdmin}/users/${user.id}`}>
                        <Eye className="h-4 w-4" />
                        View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-stone-300 shadow-none">
          <CardHeader>
            <CardTitle>Branches</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.branches.map((branch) => (
              <div
                className="flex items-center justify-between gap-3 border-b border-stone-200 pb-3"
                key={branch.id}
              >
                <div>
                  <p className="font-medium">{branch.branchName}</p>
                  <p className="text-xs text-stone-500">{branch.code}</p>
                </div>
                <StatusBadge status={branch.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-stone-300 shadow-none">
          <CardHeader>
            <CardTitle>Roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.roles.map((role) => (
              <div
                className="flex items-center justify-between gap-3 border-b border-stone-200 pb-3"
                key={role.id}
              >
                <div>
                  <p className="font-medium">{role.roleName}</p>
                  <p className="text-xs text-stone-500">{role.description || "No description"}</p>
                </div>
                <span className="text-sm text-stone-600">{role.usersCount} users</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <Card className="border-stone-300 shadow-none">
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-brand-espresso">{value}</p>
      </CardContent>
    </Card>
  );
}
