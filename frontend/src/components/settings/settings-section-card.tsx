"use client";

import {
  Activity,
  Archive,
  BadgeDollarSign,
  Bell,
  Building2,
  ChevronRight,
  CreditCard,
  Gift,
  ListChecks,
  type LucideIcon,
  Package,
  Percent,
  Printer,
  Receipt,
  Scale,
  Store,
  Truck,
  WalletCards,
  Wheat,
} from "lucide-react";
import type { JSX } from "react";

import type { SettingsIconName, SettingsSection } from "@/types/settings";

const icons: Record<SettingsIconName, LucideIcon> = {
  Activity,
  Archive,
  BadgeDollarSign,
  Bell,
  Building2,
  CreditCard,
  Gift,
  ListChecks,
  Package,
  Percent,
  Printer,
  Receipt,
  Scale,
  Store,
  Truck,
  WalletCards,
  Wheat,
};

type SettingsSectionCardProps = {
  canManage: boolean;
  onOpen: () => void;
  section: SettingsSection;
};

function statusLabel(section: SettingsSection, canManage: boolean): string {
  if (section.status !== "available") {
    return "Coming soon";
  }

  return canManage ? section.actionLabel : "View only";
}

/**
 * A row, not a card.
 *
 * The card version put the only interactive element in a circular
 * icon-only button whose label was sr-only, so a sighted user saw a bare
 * arrow and had to infer it. The card itself changed border colour on hover
 * while doing nothing on click. The icon sat in a 48px tinted tile, which is
 * the one AI-slop pattern DESIGN.md calls out by name.
 *
 * The whole row is now the control, it carries its own visible label, and the
 * status reads as text instead of a badge competing with the title.
 */
export function SettingsSectionCard({
  canManage,
  onOpen,
  section,
}: SettingsSectionCardProps): JSX.Element {
  const Icon = icons[section.iconName];
  const disabled = section.status === "disabled";

  return (
    <li className="bg-card">
      <button
        className="flex min-h-tap w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed"
        disabled={disabled}
        onClick={onOpen}
        type="button"
      >
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-foreground-muted" />
        <span className="min-w-0 flex-1">
          <span
            className={`block text-cell font-medium ${
              disabled ? "text-foreground-muted" : "text-foreground"
            }`}
          >
            {section.title}
          </span>
          <span className="block text-meta text-foreground-muted">{section.description}</span>
        </span>
        <span className="shrink-0 text-meta text-foreground-muted">
          {statusLabel(section, canManage)}
        </span>
        {disabled ? null : (
          <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-foreground-muted" />
        )}
      </button>
    </li>
  );
}
