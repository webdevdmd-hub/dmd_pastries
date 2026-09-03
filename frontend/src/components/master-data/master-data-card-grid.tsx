"use client";

import type { JSX, ReactNode } from "react";

import type { MasterDataDetail } from "@/components/master-data/master-data-detail";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { RecordStatus } from "@/types/settings";

function StatusBadge({ status }: { status: RecordStatus }): JSX.Element {
  return (
    <Badge className="capitalize" variant={status === "active" ? "secondary" : "default"}>
      {status}
    </Badge>
  );
}

/**
 * Reference records as cards, for phones. The five master data tables run to
 * seven columns and none of them survives 375px.
 */
export function MasterDataCardGrid({
  details,
  onView,
  renderActions,
}: {
  details: MasterDataDetail[];
  onView: (detail: MasterDataDetail) => void;
  /** The host owns the row's kebab, which differs per collection. */
  renderActions?: (detail: MasterDataDetail) => ReactNode;
}): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {details.map((detail) => (
        <Card
          className="cursor-pointer overflow-hidden transition-shadow duration-fast ease-out hover:shadow-sm"
          key={detail.id}
          onClick={() => onView(detail)}
        >
          <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-4 py-3">
            <div className="grid min-w-0 gap-1.5">
              <button
                className="truncate rounded-sm text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={(event) => {
                  event.stopPropagation();
                  onView(detail);
                }}
                type="button"
              >
                {detail.title}
              </button>
              {/* Badges sit beside the button, never inside it: Badge renders a
                  div, which a button may not contain. */}
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={detail.status} />
                {detail.isSystemDefault ? <Badge variant="outline">System</Badge> : null}
              </div>
            </div>
            {renderActions ? (
              <div onClick={(event) => event.stopPropagation()}>{renderActions(detail)}</div>
            ) : null}
          </div>

          <dl className="grid gap-2 px-4 py-3">
            {detail.fields.slice(0, 4).map((field) => (
              <div className="flex items-baseline justify-between gap-4" key={field.label}>
                <dt className="shrink-0 text-meta text-foreground-muted">{field.label}</dt>
                <dd
                  className={[
                    "min-w-0 break-words text-right text-cell font-medium",
                    field.mono ? "font-mono" : "",
                    field.numeric ? "tabular-nums" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      ))}
    </div>
  );
}
