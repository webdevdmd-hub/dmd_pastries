"use client";

import { Pencil } from "lucide-react";
import type { JSX } from "react";

import type { MasterDataDetail } from "@/components/master-data/master-data-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { RecordStatus } from "@/types/settings";

function StatusBadge({ status }: { status: RecordStatus }): JSX.Element {
  return (
    <Badge className="capitalize" variant={status === "active" ? "secondary" : "default"}>
      {status}
    </Badge>
  );
}

type MasterDataDetailsDrawerProps = {
  canManage: boolean;
  detail: MasterDataDetail | null;
  /** Closes the drawer, then opens the host's edit dialog. */
  onEdit: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

/**
 * One reference record, over its list.
 *
 * No tabs: a unit has five attributes and a simple category has one, so a tab
 * strip would be a control with nothing behind it. The pattern's point here is
 * that a row can be read at all -- before this, the only way to see what a
 * record held was to open its editor.
 */
export function MasterDataDetailsDrawer({
  canManage,
  detail,
  onEdit,
  onOpenChange,
  open,
}: MasterDataDetailsDrawerProps): JSX.Element {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg" side="right">
        {detail ? (
          <div className="grid min-w-0 gap-6" key={detail.id}>
            <SheetHeader className="space-y-0 p-0">
              <SheetTitle className="text-section">{detail.title}</SheetTitle>
              <SheetDescription className="sr-only">Reference record details.</SheetDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={detail.status} />
                {/* A system default cannot be removed, which is worth knowing
                    before you go looking for the delete action. */}
                {detail.isSystemDefault ? <Badge variant="outline">System default</Badge> : null}
              </div>
              {canManage ? (
                <div className="mt-3">
                  <Button onClick={onEdit} size="sm" type="button" variant="outline">
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                </div>
              ) : null}
            </SheetHeader>

            <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
              {detail.fields.map((field) => (
                <div className="min-w-0" key={field.label}>
                  <p className="text-meta text-foreground-muted">{field.label}</p>
                  <p
                    className={[
                      "mt-0.5 break-words text-cell font-medium",
                      field.mono ? "font-mono" : "",
                      field.numeric ? "tabular-nums" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {field.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Radix requires a title on every open sheet, including this one.
          <SheetHeader>
            <SheetTitle className="sr-only">Reference record</SheetTitle>
            <SheetDescription>No record selected.</SheetDescription>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}
