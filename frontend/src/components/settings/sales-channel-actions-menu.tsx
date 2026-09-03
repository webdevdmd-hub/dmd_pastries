"use client";

import { MoreHorizontal, Star, Trash2 } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SalesChannel } from "@/types/settings";

export type SalesChannelActionHandlers = {
  canManage: boolean;
  onDelete: (channel: SalesChannel) => void;
  onEdit: (channel: SalesChannel) => void;
  onSetDefault: (channel: SalesChannel) => void;
  onStatusChange: (channel: SalesChannel, status: SalesChannel["status"]) => void;
};

/**
 * Actions only, and only for someone who has them.
 *
 * The old menu rendered all five items to everyone and set `disabled` on each
 * from the same `canManage` flag, so a viewer opened a full menu of dead
 * items. It returns nothing now.
 */
export function SalesChannelActionsMenu({
  canManage,
  channel,
  onDelete,
  onEdit,
  onSetDefault,
  onStatusChange,
}: SalesChannelActionHandlers & { channel: SalesChannel }): JSX.Element | null {
  if (!canManage) {
    return null;
  }

  const isActive = channel.status === "active";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Open actions for ${channel.channelName}`}
          size="icon"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onEdit(channel)}>Edit channel</DropdownMenuItem>
        {!channel.isDefault && isActive ? (
          <DropdownMenuItem onSelect={() => onSetDefault(channel)}>
            <Star className="mr-2 h-4 w-4" />
            Set as default
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          onSelect={() => onStatusChange(channel, isActive ? "inactive" : "active")}
        >
          {isActive ? "Mark inactive" : "Mark active"}
        </DropdownMenuItem>
        {/* The default channel cannot be deleted, so the item is absent rather
            than present and disabled. */}
        {channel.isDefault ? null : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-danger-text focus:text-danger-text"
              onSelect={() => onDelete(channel)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete channel
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
