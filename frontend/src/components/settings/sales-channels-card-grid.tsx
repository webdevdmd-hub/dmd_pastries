"use client";

import { Star } from "lucide-react";
import type { JSX } from "react";

import { SalesChannelActionsMenu } from "@/components/settings/sales-channel-actions-menu";
import {
  formatCommission,
  SalesChannelStatusBadge,
} from "@/components/settings/sales-channel-details-drawer";
import type { SalesChannelsListProps } from "@/components/settings/sales-channels-table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

/** Sales channels as cards, for phones. */
export function SalesChannelsCardGrid({
  channels,
  onView,
  ...actions
}: SalesChannelsListProps): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {channels.map((channel) => (
        <Card
          className="cursor-pointer overflow-hidden transition-shadow duration-fast ease-out hover:shadow-sm"
          key={channel.id}
          onClick={() => onView(channel)}
        >
          <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
            <div className="grid min-w-0 gap-1.5">
              <button
                className="truncate rounded-sm text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(channel);
                }}
                type="button"
              >
                {channel.channelName}
              </button>
              <div className="flex flex-wrap items-center gap-1.5">
                <SalesChannelStatusBadge status={channel.status} />
                {channel.isDefault ? (
                  <Badge className="gap-1">
                    <Star className="h-3 w-3" />
                    Default
                  </Badge>
                ) : null}
              </div>
            </div>
            <div onClick={(event) => event.stopPropagation()}>
              <SalesChannelActionsMenu {...actions} channel={channel} />
            </div>
          </div>

          <p className="px-4 py-3 text-cell text-foreground-muted">
            {channel.channelType || "No type set"}
          </p>

          <div className="grid grid-cols-2 border-t border-workspace-border bg-brand-latte/30">
            <div className="min-w-0 border-r border-workspace-border px-4 py-3">
              <p className="text-meta text-foreground-muted">Commission</p>
              <p className="mt-1 text-cell font-medium tabular-nums">
                {formatCommission(channel.commissionRate)}
              </p>
            </div>
            <div className="min-w-0 px-4 py-3">
              <p className="text-meta text-foreground-muted">Default payment</p>
              <p className="mt-1 break-words text-cell font-medium">
                {channel.defaultPaymentMethodName || "None set"}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
