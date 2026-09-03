"use client";

import type { JSX } from "react";

import { RoleActionsMenu } from "@/components/roles/role-actions-menu";
import { formatRoleDate, roleTypeLabel } from "@/components/roles/role-details-drawer";
import { RoleStatusBadge } from "@/components/roles/role-status-badge";
import type { RolesListProps } from "@/components/roles/roles-table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/** The roles list as cards, for phones. */
export function RolesCardGrid({
  canViewUserAssignments,
  onView,
  roles,
  ...actions
}: RolesListProps): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {roles.map((role) => (
        <Card
          className="cursor-pointer overflow-hidden transition-shadow duration-fast ease-out hover:shadow-sm"
          key={role.id}
          onClick={() => onView(role)}
        >
          <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
            {/* The badges sit beside the button, not inside it: Badge renders a
                div, and a div inside a button (or a span) is invalid HTML and
                trips React hydration. */}
            <div className="grid min-w-0 gap-1.5">
              <button
                className="truncate rounded-sm text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(role);
                }}
                type="button"
              >
                {role.roleName}
              </button>
              <div className="flex flex-wrap items-center gap-1.5">
                <RoleStatusBadge status={role.status} />
                <Badge variant="outline">{roleTypeLabel(role)}</Badge>
              </div>
            </div>
            <div onClick={(event) => event.stopPropagation()}>
              <RoleActionsMenu {...actions} role={role} />
            </div>
          </div>

          <p className="px-4 py-3 text-cell text-foreground-muted">
            {role.description || "No description provided."}
          </p>

          <div className="grid grid-cols-2 border-t border-workspace-border bg-brand-latte/30">
            <div className="min-w-0 border-r border-workspace-border px-4 py-3">
              <p className="text-meta text-foreground-muted">Assigned users</p>
              <p
                className={
                  canViewUserAssignments
                    ? "mt-1 text-cell font-medium tabular-nums"
                    : "mt-1 text-cell text-foreground-muted"
                }
              >
                {canViewUserAssignments ? role.usersCount : "Restricted"}
              </p>
            </div>
            <div className="min-w-0 px-4 py-3">
              <p className="text-meta text-foreground-muted">Created</p>
              <p className="mt-1 text-cell font-medium tabular-nums">
                {formatRoleDate(role.createdAt)}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
