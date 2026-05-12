"use client";

import { MoreHorizontal, PencilLine, ShieldCheck, ShieldEllipsis } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Role } from "@/types/role";

type RoleActionsMenuProps = {
  canEdit: boolean;
  canManagePermissions: boolean;
  canViewPermissions: boolean;
  onEdit: (role: Role) => void;
  onManagePermissions: (role: Role) => void;
  onViewPermissions: (role: Role) => void;
  role: Role;
};

export function RoleActionsMenu({
  canEdit,
  canManagePermissions,
  canViewPermissions,
  onEdit,
  onManagePermissions,
  onViewPermissions,
  role,
}: RoleActionsMenuProps): JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={`Open actions for ${role.roleName}`} size="icon" variant="ghost">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canViewPermissions ? (
          <DropdownMenuItem
            onSelect={() => {
              onViewPermissions(role);
            }}
          >
            <ShieldCheck className="h-4 w-4" />
            View permissions
          </DropdownMenuItem>
        ) : null}
        {canEdit || canManagePermissions ? (
          <>
            <DropdownMenuSeparator />
            {canEdit ? (
              <DropdownMenuItem
                onSelect={() => {
                  onEdit(role);
                }}
              >
                <PencilLine className="h-4 w-4" />
                Edit role
              </DropdownMenuItem>
            ) : null}
            {canManagePermissions ? (
              <DropdownMenuItem
                onSelect={() => {
                  onManagePermissions(role);
                }}
              >
                <ShieldEllipsis className="h-4 w-4" />
                Manage permissions
              </DropdownMenuItem>
            ) : null}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
