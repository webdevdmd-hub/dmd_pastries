"use client";

import type { JSX } from "react";

import { type RoleActionHandlers, RoleActionsMenu } from "@/components/roles/role-actions-menu";
import { formatRoleDate, roleTypeLabel } from "@/components/roles/role-details-drawer";
import { RoleStatusBadge } from "@/components/roles/role-status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Role } from "@/types/role";

export type RolesListProps = RoleActionHandlers & {
  canViewUserAssignments: boolean;
  /** Opens the role's details; the whole row is the target. */
  onView: (role: Role) => void;
  roles: Role[];
};

/**
 * Seven columns became six.
 *
 * "Type" was a whole column repeating the System Default / Custom badge that
 * already sat under the role name, so every row said the same thing twice.
 * Created At went to the drawer.
 */
export function RolesTable({
  canViewUserAssignments,
  onView,
  roles,
  ...actions
}: RolesListProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Role</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Assigned users</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {roles.map((role) => (
          // The row opens the drawer; the name is also a button so the keyboard
          // has a focusable target for the same action.
          <TableRow className="cursor-pointer" key={role.id} onClick={() => onView(role)}>
            <TableCell className="min-w-52 whitespace-normal">
              {/* The badge sits beside the button, not inside it: Badge renders
                  a div, which a button may not contain. */}
              <div className="grid gap-1.5">
                <button
                  className="w-fit rounded-sm text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={(event) => {
                    event.stopPropagation();
                    onView(role);
                  }}
                  type="button"
                >
                  {role.roleName}
                </button>
                <Badge className="w-fit" variant="outline">
                  {roleTypeLabel(role)}
                </Badge>
              </div>
            </TableCell>
            <TableCell className="min-w-60 whitespace-normal text-foreground-muted">
              {role.description || "No description provided."}
            </TableCell>
            <TableCell
              className={
                canViewUserAssignments
                  ? "text-right tabular-nums"
                  : "text-right text-foreground-muted"
              }
            >
              {canViewUserAssignments ? role.usersCount : "Restricted"}
            </TableCell>
            <TableCell>
              <RoleStatusBadge status={role.status} />
            </TableCell>
            <TableCell className="tabular-nums text-foreground-muted">
              {formatRoleDate(role.createdAt)}
            </TableCell>
            {/* The menu must not also open the drawer. */}
            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
              <RoleActionsMenu {...actions} role={role} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
