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

export type UserActionHandlers = {
  canDelete: boolean;
  canEdit: boolean;
  currentUserId: string | null;
  onChangeStatus: (user: User, status: UserStatus) => void;
  onDelete: (user: User) => void;
  onEdit: (user: User) => void;
};

/**
 * Actions only. "View details" is gone -- it called the same function as
 * "Edit user" and opened the same editor, so the menu offered one action
 * twice under two names. Reading a user is now the row's own click.
 */
export function UserActionsMenu({
  canDelete,
  canEdit,
  currentUserId,
  onChangeStatus,
  onDelete,
  onEdit,
  user,
}: UserActionHandlers & { user: User }): JSX.Element | null {
  const isCurrentUser = currentUserId === user.id;
  const canManageStatus = canEdit && !isCurrentUser;
  const canDeleteUser = canDelete && !isCurrentUser;

  if (!canEdit && !canDeleteUser) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={`Open actions for ${user.fullName}`} size="icon" variant="ghost">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEdit ? (
          <DropdownMenuItem onSelect={() => onEdit(user)}>Edit user</DropdownMenuItem>
        ) : null}
        {canManageStatus ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={user.status === "active"}
              onSelect={() => onChangeStatus(user, "active")}
            >
              Activate user
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={user.status === "inactive"}
              onSelect={() => onChangeStatus(user, "inactive")}
            >
              Deactivate user
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={user.status === "suspended"}
              onSelect={() => onChangeStatus(user, "suspended")}
            >
              Suspend user
            </DropdownMenuItem>
          </>
        ) : null}
        {canDeleteUser ? (
          <>
            <DropdownMenuSeparator />
            {/* text-danger-text, not text-destructive: the latter is not a
                token in this design system and rendered as inherited colour. */}
            <DropdownMenuItem
              className="text-danger-text focus:text-danger-text"
              onSelect={() => onDelete(user)}
            >
              Delete user
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
