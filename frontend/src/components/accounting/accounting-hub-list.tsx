"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ComponentType, JSX } from "react";

import type { Permission } from "@/types/permission";

export type AccountingHubItem = {
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  /** Held by a user who can change things here; absent means read-only. */
  managePermission?: Permission | undefined;
  permissionAny: readonly Permission[];
  /** Overrides the manage/view label, e.g. "Statement". */
  status?: string | undefined;
};

export type AccountingHubSection = {
  description: string;
  items: readonly AccountingHubItem[];
  label: string;
};

/**
 * A hairline-divided list, the same idiom as the Settings hub.
 *
 * It replaced a four-across card grid. Sixteen accounting destinations at
 * identical card weight is a wall to scan, and each card spent a 44px tinted
 * icon tile, a paragraph and an "Open" affordance to say what one row says.
 * The section headings already carry the structure.
 *
 * Rows are links rather than buttons: these are navigations, so a middle
 * click or a modifier click behaves the way the rest of the app does.
 */
export function AccountingHubList({
  canManage,
  items,
}: {
  canManage: (item: AccountingHubItem) => boolean;
  items: readonly AccountingHubItem[];
}): JSX.Element {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <ul className="grid gap-px bg-border">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <li className="bg-card" key={item.href}>
              <Link
                className="flex min-h-tap w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                href={item.href}
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-foreground-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block text-cell font-medium text-foreground">{item.label}</span>
                  <span className="block text-meta text-foreground-muted">{item.description}</span>
                </span>
                <span className="hidden shrink-0 text-meta text-foreground-muted sm:block">
                  {item.status ?? (canManage(item) ? "Manage" : "View only")}
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-foreground-muted"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
