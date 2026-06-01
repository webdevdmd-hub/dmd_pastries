import type { JSX } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserActionsMenu } from "@/components/users/user-actions-menu";
import { UserStatusBadge } from "@/components/users/user-status-badge";
import { cn } from "@/lib/utils/cn";
import type { User, UserStatus } from "@/types/user";

type UsersTableProps = {
  branchNameById: ReadonlyMap<string, string>;
  canDelete: boolean;
  canEdit: boolean;
  currentUserId: string | null;
  onChangeStatus: (user: User, status: UserStatus) => void;
  onDelete: (user: User) => void;
  onEdit: (user: User) => void;
  onView: (user: User) => void;
  users: User[];
};

function initials(fullName: string): string {
  return fullName
    .split(" ")
    .map((segment) => segment[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRelativeDate(value: string | null): string {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const differenceInMs = date.getTime() - Date.now();
  const differenceInDays = Math.round(differenceInMs / (1000 * 60 * 60 * 24));

  if (Math.abs(differenceInDays) >= 1) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(differenceInDays, "day");
  }

  const differenceInHours = Math.round(differenceInMs / (1000 * 60 * 60));

  if (Math.abs(differenceInHours) >= 1) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(differenceInHours, "hour");
  }

  const differenceInMinutes = Math.round(differenceInMs / (1000 * 60));

  if (Math.abs(differenceInMinutes) >= 1) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      differenceInMinutes,
      "minute",
    );
  }

  return "Just now";
}

export function UsersTable({
  branchNameById,
  canDelete,
  canEdit,
  currentUserId,
  onChangeStatus,
  onDelete,
  onEdit,
  onView,
  users,
}: UsersTableProps): JSX.Element {
  return (
    <Table className="min-w-[1100px]">
      <TableHeader>
        <TableRow>
          <TableHead>Staff member</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Email Verified</TableHead>
          <TableHead>Last Login</TableHead>
          <TableHead>Created At</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow
            className={cn(user.branchId === null ? "bg-amber-50/60 hover:bg-amber-50" : undefined)}
            key={user.id}
          >
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar className="h-11 w-11">
                  <AvatarFallback>{initials(user.fullName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-brand-espresso">{user.fullName}</p>
                  <p className="truncate text-xs text-brand-mocha">
                    {user.roleName} - {user.id.slice(0, 8)}
                  </p>
                </div>
              </div>
            </TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>{user.phone}</TableCell>
            <TableCell>
              {user.branchId ? (
                (branchNameById.get(user.branchId) ?? "Assigned branch")
              ) : (
                <div className="flex flex-col gap-1">
                  <Badge className="w-fit border-amber-300 bg-amber-100 text-amber-900">
                    Needs branch setup
                  </Badge>
                  <span className="text-xs text-brand-mocha">No branch assigned</span>
                </div>
              )}
            </TableCell>
            <TableCell>{user.roleName}</TableCell>
            <TableCell>
              <UserStatusBadge status={user.status} />
            </TableCell>
            <TableCell>{user.emailVerified ? "Verified" : "Pending"}</TableCell>
            <TableCell>{formatRelativeDate(user.lastLoginAt)}</TableCell>
            <TableCell>{formatDate(user.createdAt)}</TableCell>
            <TableCell className="text-right">
              <UserActionsMenu
                canDelete={canDelete}
                canEdit={canEdit}
                currentUserId={currentUserId}
                onChangeStatus={onChangeStatus}
                onDelete={onDelete}
                onEdit={onEdit}
                onView={onView}
                user={user}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
