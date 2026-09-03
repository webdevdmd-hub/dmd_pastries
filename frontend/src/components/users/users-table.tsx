"use client";

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
import { type UserActionHandlers, UserActionsMenu } from "@/components/users/user-actions-menu";
import { formatUserRelativeDate, userInitials } from "@/components/users/user-details-drawer";
import { UserStatusBadge } from "@/components/users/user-status-badge";
import { cn } from "@/lib/utils/cn";
import type { User } from "@/types/user";

export type UsersListProps = UserActionHandlers & {
  branchNameById: ReadonlyMap<string, string>;
  /** Opens the user's details; the whole row is the target. */
  onView: (user: User) => void;
  users: User[];
};

/**
 * Ten columns became six.
 *
 * The old table carried a `min-w-[1100px]`, so it scrolled sideways on every
 * laptop and the last thing you could read was the row you wanted. Role moved
 * under the name where it already appeared, phone and email share the contact
 * column, and "Email verified", "Created at" and the id fragment went to the
 * drawer.
 */
export function UsersTable({
  branchNameById,
  onView,
  users,
  ...actions
}: UsersListProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Staff member</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last login</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          // The row opens the drawer; the name is also a button so the keyboard
          // has a focusable target for the same action.
          <TableRow
            className={cn(
              "cursor-pointer",
              user.branchId === null ? "bg-warning-tint/60 hover:bg-warning-tint" : undefined,
            )}
            key={user.id}
            onClick={() => onView(user)}
          >
            <TableCell>
              <button
                className="flex items-center gap-3 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(user);
                }}
                type="button"
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback>{userInitials(user.fullName)}</AvatarFallback>
                </Avatar>
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate font-medium">{user.fullName}</span>
                  <span className="truncate text-meta text-foreground-muted">{user.roleName}</span>
                </span>
              </button>
            </TableCell>
            <TableCell>
              <div className="grid gap-0.5">
                <span>{user.email}</span>
                <span className="text-meta tabular-nums text-foreground-muted">
                  {user.phone || "No phone"}
                </span>
              </div>
            </TableCell>
            <TableCell>
              {user.branchId ? (
                (branchNameById.get(user.branchId) ?? "Assigned branch")
              ) : (
                <Badge className="w-fit border-warning/30 bg-warning-tint text-warning-text">
                  Needs branch setup
                </Badge>
              )}
            </TableCell>
            <TableCell>
              <UserStatusBadge status={user.status} />
            </TableCell>
            <TableCell className="tabular-nums text-foreground-muted">
              {formatUserRelativeDate(user.lastLoginAt)}
            </TableCell>
            {/* The menu must not also open the drawer. */}
            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
              <UserActionsMenu {...actions} user={user} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
