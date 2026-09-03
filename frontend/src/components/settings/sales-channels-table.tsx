"use client";

import { Star } from "lucide-react";
import type { JSX } from "react";

import {
  type SalesChannelActionHandlers,
  SalesChannelActionsMenu,
} from "@/components/settings/sales-channel-actions-menu";
import {
  formatCommission,
  SalesChannelStatusBadge,
} from "@/components/settings/sales-channel-details-drawer";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SalesChannel } from "@/types/settings";

export type SalesChannelsListProps = SalesChannelActionHandlers & {
  channels: SalesChannel[];
  /** Opens the channel's details; the whole row is the target. */
  onView: (channel: SalesChannel) => void;
};

/**
 * Seven columns became six. "External ID" said "Required" or "Not required"
 * down a whole column for a flag most channels do not set; it moved to the
 * drawer, and the type rides under the channel name.
 */
export function SalesChannelsTable({
  channels,
  onView,
  ...actions
}: SalesChannelsListProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Channel</TableHead>
          <TableHead className="text-right">Commission</TableHead>
          <TableHead>Default payment</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {channels.map((channel) => (
          // The row opens the drawer; the name is also a button so the keyboard
          // has a focusable target for the same action.
          <TableRow className="cursor-pointer" key={channel.id} onClick={() => onView(channel)}>
            <TableCell>
              <div className="grid gap-1">
                <button
                  className="flex w-fit items-center gap-2 rounded-sm text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={(event) => {
                    event.stopPropagation();
                    onView(channel);
                  }}
                  type="button"
                >
                  {channel.channelName}
                </button>
                {/* Badges beside the button, never inside it: Badge renders a
                    div, which a button may not contain. */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-meta text-foreground-muted">
                    {channel.channelType || "No type"}
                  </span>
                  {channel.isDefault ? (
                    <Badge className="gap-1">
                      <Star className="h-3 w-3" />
                      Default
                    </Badge>
                  ) : null}
                </div>
              </div>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCommission(channel.commissionRate)}
            </TableCell>
            <TableCell>{channel.defaultPaymentMethodName || "None set"}</TableCell>
            <TableCell>
              <SalesChannelStatusBadge status={channel.status} />
            </TableCell>
            {/* The menu must not also open the drawer. */}
            <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
              <SalesChannelActionsMenu {...actions} channel={channel} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
