"use client";

import { Pencil, Star } from "lucide-react";
import type { JSX, ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { SalesChannel } from "@/types/settings";

export function formatCommission(rate: number | null): string {
  return `${(rate ?? 0).toFixed(2)}%`;
}

export function SalesChannelStatusBadge({
  status,
}: {
  status: SalesChannel["status"];
}): JSX.Element {
  return (
    <Badge className="capitalize" variant={status === "active" ? "secondary" : "default"}>
      {status}
    </Badge>
  );
}

function InfoField({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return (
    <div className="min-w-0">
      <p className="text-meta text-foreground-muted">{label}</p>
      <div className="mt-0.5 break-words text-cell font-medium">{value}</div>
    </div>
  );
}

type SalesChannelDetailsDrawerProps = {
  canManage: boolean;
  channel: SalesChannel | null;
  /** Closes the drawer, then opens the host's form dialog. */
  onEdit: (channel: SalesChannel) => void;
  onOpenChange: (open: boolean) => void;
  onSetDefault: (channel: SalesChannel) => void;
  open: boolean;
};

/**
 * One channel, over the list.
 *
 * No tabs: a channel has six attributes, so a tab strip would be a control
 * with nothing behind it. Before this there was no way to read a channel at
 * all -- the only route in was its editor.
 */
export function SalesChannelDetailsDrawer({
  canManage,
  channel,
  onEdit,
  onOpenChange,
  onSetDefault,
  open,
}: SalesChannelDetailsDrawerProps): JSX.Element {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg" side="right">
        {channel ? (
          <div className="grid min-w-0 gap-6" key={channel.id}>
            <SheetHeader className="space-y-0 p-0">
              <SheetTitle className="text-section">{channel.channelName}</SheetTitle>
              <SheetDescription className="sr-only">
                Sales channel details and defaults.
              </SheetDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <SalesChannelStatusBadge status={channel.status} />
                {channel.isDefault ? (
                  <Badge className="gap-1">
                    <Star className="h-3 w-3" />
                    Default
                  </Badge>
                ) : null}
              </div>
              {canManage ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => onEdit(channel)} size="sm" type="button" variant="outline">
                    <Pencil className="h-4 w-4" />
                    Edit channel
                  </Button>
                  {!channel.isDefault && channel.status === "active" ? (
                    <Button
                      onClick={() => onSetDefault(channel)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Star className="h-4 w-4" />
                      Set as default
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </SheetHeader>

            <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
              <InfoField label="Channel type" value={channel.channelType || "Not set"} />
              <InfoField
                label="Commission"
                value={
                  <span className="tabular-nums">{formatCommission(channel.commissionRate)}</span>
                }
              />
              <InfoField
                label="Default payment method"
                value={channel.defaultPaymentMethodName || "None set"}
              />
              <InfoField
                label="External order number"
                value={channel.requiresExternalOrderNumber ? "Required" : "Not required"}
              />
            </div>

            {/* Kept from the old page, where it sat below the table as a note
                in a tinted box. It belongs with the record it explains. */}
            <div className="rounded-lg border border-border bg-muted p-4">
              <p className="text-cell font-medium">What a channel is</p>
              <p className="mt-1 text-cell text-foreground-muted">
                A sales channel is where the order came from. A payment method is how the customer
                paid, and a payment account is where that money is held for accounting.
              </p>
            </div>
          </div>
        ) : (
          // Radix requires a title on every open sheet, including this one.
          <SheetHeader>
            <SheetTitle className="sr-only">Sales channel</SheetTitle>
            <SheetDescription>No channel selected.</SheetDescription>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}
