"use client";

import { MoreHorizontal } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { User, UserStatus } from "@/types/user";

type UserActionsMenuProps = {
  currentUserId: string | null;
  canDelete: boolean;
  canEdit: boolean;
  onChangeStatus: (user: User, status: UserStatus) => void;
  onDelete: (user: User) => void;
  onEdit: (user: User) => void;
  onView: (user: User) => void;
  user: User;
};

export function UserActionsMenu({
  currentUserId,
  canDelete,
  canEdit,
  onChangeStatus,
  onDelete,
  onEdit,
  onView,
  user,
}: UserActionsMenuProps): JSX.Element {
  const isCurrentUser = currentUserId === user.id;
  const canChangeStatus = canEdit && !isCurrentUser;
  const canDeleteUser = canDelete && !isCurrentUser;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={`Open actions for ${user.fullName}`} size="icon" variant="ghost">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onView(user)}>View details</DropdownMenuItem>
        {canEdit ? (
          <DropdownMenuItem onClick={() => onEdit(user)}>Edit user</DropdownMenuItem>
        ) : null}
        {canEdit ? <DropdownMenuSeparator /> : null}
        {canEdit ? (
          <DropdownMenuItem
            disabled={!canChangeStatus || user.status === "active"}
            onClick={() => onChangeStatus(user, "active")}
          >
            Activate user
          </DropdownMenuItem>
        ) : null}
        {canEdit ? (
          <DropdownMenuItem
            disabled={!canChangeStatus || user.status === "inactive"}
            onClick={() => onChangeStatus(user, "inactive")}
          >
            Deactivate user
          </DropdownMenuItem>
        ) : null}
        {canEdit ? (
          <DropdownMenuItem
            disabled={!canChangeStatus || user.status === "suspended"}
            onClick={() => onChangeStatus(user, "suspended")}
          >
            Suspend user
          </DropdownMenuItem>
        ) : null}
        {canDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              disabled={!canDeleteUser}
              onClick={() => onDelete(user)}
            >
              Delete user
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
