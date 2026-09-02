"use client";

import { MoreHorizontal } from "lucide-react";
import type { JSX } from "react";

import { BranchStatusBadge } from "@/components/branches/branch-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Branch, BranchStatus } from "@/types/branch";
import type { User } from "@/types/user";

type BranchesTableProps = {
  branches: Branch[];
  canManage: boolean;
  managerUsers: User[];
  onEdit: (branch: Branch) => void;
  onStatusChange: (branch: Branch, status: BranchStatus) => void;
};

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(date);
}

export function BranchesTable({
  branches,
  canManage,
  managerUsers,
  onEdit,
  onStatusChange,
}: BranchesTableProps): JSX.Element {
  const managerNameById = new Map(managerUsers.map((manager) => [manager.id, manager.fullName]));

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Branch</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell>
                  <div>
                    <p className="font-semibold text-brand-espresso">{branch.name}</p>
                    <p className="mt-1 text-xs text-brand-mocha">Code: {branch.code}</p>
                    {branch.isDefault ? (
                      <p className="mt-1 text-xs font-medium text-brand-caramel">Default branch</p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <p className="max-w-40 truncate text-sm text-brand-mocha">
                    {branch.managerUserId
                      ? (managerNameById.get(branch.managerUserId) ?? branch.managerUserId)
                      : "No manager assigned"}
                  </p>
                </TableCell>
                <TableCell>
                  <div className="space-y-1 text-sm">
                    <p>{branch.phone ?? "No phone"}</p>
                    <p className="text-brand-mocha">{branch.email ?? "No email"}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="max-w-xs text-sm leading-6">
                    <p>{branch.address || "No address"}</p>
                    <p className="text-brand-mocha">{branch.timezone || "No timezone"}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <BranchStatusBadge status={branch.status} />
                </TableCell>
                <TableCell>{formatDate(branch.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        aria-label={`Open actions for ${branch.name}`}
                        size="icon"
                        variant="ghost"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem disabled={!canManage} onClick={() => onEdit(branch)}>
                        Edit branch
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={!canManage || branch.status === "active"}
                        onClick={() => onStatusChange(branch, "active")}
                      >
                        Mark active
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!canManage || branch.status === "inactive"}
                        onClick={() => onStatusChange(branch, "inactive")}
                      >
                        Mark inactive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
