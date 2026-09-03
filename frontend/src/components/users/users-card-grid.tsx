"use client";

import type { JSX } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { UserActionsMenu } from "@/components/users/user-actions-menu";
import { formatUserRelativeDate, userInitials } from "@/components/users/user-details-drawer";
import { UserStatusBadge } from "@/components/users/user-status-badge";
import type { UsersListProps } from "@/components/users/users-table";

/** The staff list as cards, for phones. */
export function UsersCardGrid({
  branchNameById,
  onView,
  users,
  ...actions
}: UsersListProps): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {users.map((user) => (
        <Card
          className={`cursor-pointer overflow-hidden transition-shadow duration-fast ease-out hover:shadow-sm ${
            user.branchId === null ? "border-warning/40" : ""
          }`}
          key={user.id}
          onClick={() => onView(user)}
        >
          <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
            <button
              className="flex min-w-0 items-center gap-3 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={(event) => {
                event.stopPropagation();
                onView(user);
              }}
              type="button"
            >
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback>{userInitials(user.fullName)}</AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 gap-0.5">
                <span className="truncate font-medium">{user.fullName}</span>
                <span className="truncate text-meta text-foreground-muted">{user.roleName}</span>
              </span>
            </button>
            <div onClick={(event) => event.stopPropagation()}>
              <UserActionsMenu {...actions} user={user} />
            </div>
          </div>

          <div className="grid gap-2 px-4 py-3">
            <UserStatusBadge status={user.status} />
            <p className="break-words text-cell">{user.email}</p>
            <p className="text-cell tabular-nums text-foreground-muted">
              {user.phone || "No phone"}
            </p>
          </div>

          <div className="grid grid-cols-2 border-t border-workspace-border bg-brand-latte/30">
            <div className="min-w-0 border-r border-workspace-border px-4 py-3">
              <p className="text-meta text-foreground-muted">Branch</p>
              {user.branchId ? (
                <p className="mt-1 break-words text-cell font-medium">
                  {branchNameById.get(user.branchId) ?? "Assigned branch"}
                </p>
              ) : (
                <Badge className="mt-1 w-fit border-warning/30 bg-warning-tint text-warning-text">
                  Needs setup
                </Badge>
              )}
            </div>
            <div className="min-w-0 px-4 py-3">
              <p className="text-meta text-foreground-muted">Last login</p>
              <p className="mt-1 text-cell font-medium tabular-nums">
                {formatUserRelativeDate(user.lastLoginAt)}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
