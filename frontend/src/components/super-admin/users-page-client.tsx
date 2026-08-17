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
import { useSuperAdminUsers } from "@/hooks/use-super-admin";
import { getErrorMessage } from "@/lib/api/client";

import { formatDateTime } from "./format";
import { StatusBadge } from "./status-badge";

export function SuperAdminUsersPageClient(): JSX.Element {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const usersQuery = useSuperAdminUsers({ search, status });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold text-foreground-muted">Platform Identity</p>
          <h2 className="mt-1 text-2xl font-semibold text-brand-espresso">Users</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground-muted">
            Search every tenant user by name, email, Appwrite ID, or business.
          </p>
        </div>
        <Button
          onClick={() => {
            void usersQuery.refetch();
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
            placeholder="Search user, email, Appwrite ID, or business"
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
            <SelectItem value="invited">Invited</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {usersQuery.isLoading ? <LoadingState /> : null}

      {usersQuery.error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load users</AlertTitle>
          <AlertDescription>{getErrorMessage(usersQuery.error)}</AlertDescription>
        </Alert>
      ) : null}

      {usersQuery.data ? (
        <Card className="border-border shadow-none">
          <CardContent className="overflow-x-auto p-0">
            <Table className="min-w-[1180px]">
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead>Appwrite ID</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersQuery.data.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <p className="font-semibold text-brand-espresso">{user.fullName}</p>
                      <p className="text-xs text-foreground-muted">{user.id}</p>
                    </TableCell>
                    <TableCell>
                      <Link
                        className="font-medium text-brand-caramel hover:underline"
                        href={`${ROUTES.superAdmin}/businesses/${user.businessId}`}
                      >
                        {user.businessName}
                      </Link>
                    </TableCell>
                    <TableCell>{user.roleName}</TableCell>
                    <TableCell>{user.branchName ?? "No branch"}</TableCell>
                    <TableCell>
                      <StatusBadge status={user.status} />
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{formatDateTime(user.lastLoginAt)}</TableCell>
                    <TableCell className="font-mono text-xs">{user.appwriteUserId}</TableCell>
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
      ) : null}
    </div>
  );
}
