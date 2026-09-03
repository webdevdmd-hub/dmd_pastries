"use client";

import { ChevronDown } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import type { ActivityLog, ActivityMetadataValue } from "@/types/activity-log";

export function labelFromKey(value: string): string {
  return value
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function formatAuditValue(value: ActivityMetadataValue): string {
  if (value === null || value === "") {
    return "Empty";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.map((entry) => String(entry)).join(", ") : "Empty";
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, entry]) => `${labelFromKey(key)}: ${String(entry)}`)
      .join(", ");
  }

  return String(value);
}

export function formatAuditTime(value: string, timeZone: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-AE", { hour: "2-digit", minute: "2-digit", timeZone }).format(
    date,
  );
}

export function auditDayKey(value: string, timeZone: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-AE", {
    day: "numeric",
    month: "long",
    timeZone,
    weekday: "long",
    year: "numeric",
  }).format(date);
}

/** Metadata the row already states in words, so it is noise inside Details. */
const suppressedMetadataKeys = new Set([
  "action",
  "entity",
  "entity_id",
  "entity_type",
  "event",
  "event_type",
  "module",
  "record",
  "summary",
]);

export function visibleMetadataEntries(
  metadata: Record<string, ActivityMetadataValue>,
): [string, ActivityMetadataValue][] {
  return Object.entries(metadata).filter(
    ([key, value]) => !suppressedMetadataKeys.has(key) && value !== null && value !== "",
  );
}

/**
 * One line per event, opened only when someone wants the detail.
 *
 * Every entry used to render seven stacked sections at full strength -- two
 * badges, a boxed Record and Module pair that repeated the badge above them,
 * the target user, the summary, a three-column changes grid, a metadata block,
 * an IP and full user-agent box, and a raw "eventType / entityType" line. A log
 * is something you scan; the detail belongs behind a disclosure.
 */
export function AuditLogEntry({
  log,
  timezone,
}: {
  log: ActivityLog;
  timezone: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const metadata = visibleMetadataEntries(log.metadata);
  const hasDetail =
    log.changes.length > 0 ||
    metadata.length > 0 ||
    log.ipAddress.length > 0 ||
    log.userAgent.length > 0;
  const target =
    log.targetUserName && log.targetUserName !== log.actorUserName ? log.targetUserName : null;

  return (
    <li className="bg-card">
      <button
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-fast ease-out hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="w-12 shrink-0 pt-0.5 text-meta tabular-nums text-foreground-muted">
          {formatAuditTime(log.createdAt, timezone)}
        </span>
        <span className="min-w-0 flex-1">
          {/* The sentence the backend already writes, used as written, instead
              of five boxed fields restating its parts. */}
          <span className="block text-cell">
            <span className="font-medium">{log.actorUserName || "System"}</span>{" "}
            {log.actionLabel.toLowerCase()}
            {log.recordLabel ? (
              <>
                {" "}
                <span className="font-medium">{log.recordLabel}</span>
              </>
            ) : null}
            {target ? <> for {target}</> : null}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{log.moduleLabel}</Badge>
            {log.changes.length > 0 ? (
              <span className="text-meta text-foreground-muted">
                <span className="tabular-nums">{log.changes.length}</span>{" "}
                {log.changes.length === 1 ? "field" : "fields"} changed
              </span>
            ) : null}
          </span>
        </span>
        {hasDetail ? (
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 text-foreground-muted transition-transform duration-fast ease-out",
              open ? "rotate-180" : "",
            )}
          />
        ) : null}
      </button>

      {open && hasDetail ? (
        <div className="grid gap-4 border-t border-border px-4 py-4">
          {log.changes.length > 0 ? (
            <div className="grid gap-2">
              <p className="text-meta text-foreground-muted">Changed</p>
              {/* Old and new read as one movement per field rather than three
                  columns to line up by eye. */}
              {log.changes.map((change) => (
                <div
                  className="grid gap-1 rounded-lg border border-border px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-baseline sm:gap-3"
                  key={`${change.field}-${change.label}`}
                >
                  <p className="text-cell font-medium">
                    {change.label || labelFromKey(change.field)}
                  </p>
                  <p className="min-w-0 break-words text-cell">
                    <span className="text-foreground-muted line-through">
                      {formatAuditValue(change.oldValue)}
                    </span>
                    <span className="mx-1.5 text-foreground-muted">&rarr;</span>
                    <span className="font-medium">{formatAuditValue(change.newValue)}</span>
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {metadata.length > 0 ? (
            <div className="grid gap-2">
              <p className="text-meta text-foreground-muted">Details</p>
              <dl className="grid gap-2 sm:grid-cols-2">
                {metadata.map(([key, value]) => (
                  <div className="min-w-0" key={key}>
                    <dt className="text-meta text-foreground-muted">{labelFromKey(key)}</dt>
                    <dd className="break-words text-cell">{formatAuditValue(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {/* Where it came from and what wrote it: forensic, so it sits last
              and small rather than in a box of its own above the changes. */}
          {log.ipAddress || log.userAgent ? (
            <p className="break-words text-meta text-foreground-muted">
              {log.ipAddress ? <>IP {log.ipAddress}</> : null}
              {log.ipAddress && log.userAgent ? " · " : null}
              {log.userAgent}
            </p>
          ) : null}

          <p className="font-mono text-meta text-foreground-muted">
            {log.eventType} · {log.entityType}
            {log.entityId ? <> · {log.entityId}</> : null}
          </p>
        </div>
      ) : null}
    </li>
  );
}
