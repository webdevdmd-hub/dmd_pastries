"use client";

import { MoreHorizontal, PencilLine, ShieldEllipsis } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Role } from "@/types/role";

export type RoleActionHandlers = {
  canEdit: boolean;
  canManagePermissions: boolean;
  onEdit: (role: Role) => void;
  onManagePermissions: (role: Role) => void;
};

/**
 * Actions only. "View permissions" is gone: the row opens the drawer and the
 * permissions are one of its tabs, so reading them no longer needs a
 * full-screen dialog. A reader with neither right sees no menu.
 */
export function RoleActionsMenu({
  canEdit,
  canManagePermissions,
  onEdit,
  onManagePermissions,
  role,
}: RoleActionHandlers & { role: Role }): JSX.Element | null {
  if (!canEdit && !canManagePermissions) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={`Open actions for ${role.roleName}`} size="icon" variant="ghost">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEdit ? (
          <DropdownMenuItem onSelect={() => onEdit(role)}>
            <PencilLine className="h-4 w-4" />
            Edit role
          </DropdownMenuItem>
        ) : null}
        {canManagePermissions ? (
          <DropdownMenuItem onSelect={() => onManagePermissions(role)}>
            <ShieldEllipsis className="h-4 w-4" />
            Manage permissions
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
