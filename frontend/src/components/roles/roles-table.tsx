"use client";

import type { JSX } from "react";

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

import { RoleActionsMenu } from "./role-actions-menu";
import { RoleStatusBadge } from "./role-status-badge";

type RolesTableProps = {
  canEdit: boolean;
  canManagePermissions: boolean;
  canViewPermissions: boolean;
  canViewUserAssignments: boolean;
  onEdit: (role: Role) => void;
  onManagePermissions: (role: Role) => void;
  onViewPermissions: (role: Role) => void;
  roles: Role[];
  selectedRoleId: string | null;
};

function formatDate(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(parsed);
}

export function RolesTable({
  canEdit,
  canManagePermissions,
  canViewPermissions,
  canViewUserAssignments,
  onEdit,
  onManagePermissions,
  onViewPermissions,
  roles,
  selectedRoleId,
}: RolesTableProps): JSX.Element {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Role Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Assigned Users</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => (
            <TableRow
              key={role.id}
              className={selectedRoleId === role.id ? "bg-brand-latte/80" : undefined}
            >
              <TableCell className="min-w-[220px]">
                <div className="space-y-2">
                  <div className="font-medium text-brand-espresso">{role.roleName}</div>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      className={
                        role.isSystemDefault
                          ? "border-brand-caramel/70 bg-brand-caramel/15 text-brand-mocha"
                          : "border-brand-cappuccino bg-brand-cappuccino/45 text-brand-espresso"
                      }
                    >
                      {role.isSystemDefault ? "System Default" : "Custom"}
                    </Badge>
                  </div>
                </div>
              </TableCell>
              <TableCell className="min-w-[240px] text-brand-mocha">
                {role.description || "No description provided."}
              </TableCell>
              <TableCell>{role.isSystemDefault ? "System Default" : "Custom Role"}</TableCell>
              <TableCell>{canViewUserAssignments ? role.usersCount : "Restricted"}</TableCell>
              <TableCell>
                <RoleStatusBadge status={role.status} />
              </TableCell>
              <TableCell>{formatDate(role.createdAt)}</TableCell>
              <TableCell className="text-right">
                <RoleActionsMenu
                  canEdit={canEdit}
                  canManagePermissions={canManagePermissions}
                  canViewPermissions={canViewPermissions}
                  onEdit={onEdit}
                  onManagePermissions={onManagePermissions}
                  onViewPermissions={onViewPermissions}
                  role={role}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
