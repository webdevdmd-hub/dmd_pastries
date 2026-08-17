"use client";

import { Eye, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";

import { LoadingState } from "@/components/shared/loading-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import { useSuperAdminBusinesses } from "@/hooks/use-super-admin";
import { getErrorMessage } from "@/lib/api/client";

import { formatCount, formatDateTime } from "./format";
import { StatusBadge } from "./status-badge";

export function SuperAdminBusinessesPageClient(): JSX.Element {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const businessesQuery = useSuperAdminBusinesses({ search, status });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold text-foreground-muted">Tenant Visibility</p>
          <h2 className="mt-1 text-2xl font-semibold text-brand-espresso">Businesses</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground-muted">
            Search every tenant and inspect owner, subscription, user, branch, and role setup.
          </p>
        </div>
        <Button
          onClick={() => {
            void businessesQuery.refetch();
          }}
          type="button"
          variant="outline"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
          <Input
            className="pl-9"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search business, owner name, or owner email"
            value={search}
          />
        </div>
        <Select onValueChange={setStatus} value={status}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {businessesQuery.isLoading ? <LoadingState /> : null}

      {businessesQuery.error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load businesses</AlertTitle>
          <AlertDescription>{getErrorMessage(businessesQuery.error)}</AlertDescription>
        </Alert>
      ) : null}

      {businessesQuery.data ? (
        <Card className="border-border shadow-none">
          <CardContent className="overflow-x-auto p-0">
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Branches</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {businessesQuery.data.map((business) => (
                  <TableRow key={business.id}>
                    <TableCell>
                      <div>
                        <p className="font-semibold text-brand-espresso">{business.businessName}</p>
                        <p className="text-xs text-foreground-muted">{business.id}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{business.ownerName ?? "No owner"}</p>
                        <p className="text-xs text-foreground-muted">
                          {business.ownerEmail ?? "No email"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={business.status} />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{business.subscriptionStatus ?? "No subscription"}</p>
                        <p className="text-xs text-foreground-muted">
                          {business.planType ?? "No plan"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{formatCount(business.usersCount)}</TableCell>
                    <TableCell>{formatCount(business.branchesCount)}</TableCell>
                    <TableCell>{formatCount(business.rolesCount)}</TableCell>
                    <TableCell>{formatDateTime(business.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`${ROUTES.superAdmin}/businesses/${business.id}`}>
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
      ) : null}
    </div>
  );
}
