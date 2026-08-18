"use client";

import {
  Activity,
  Archive,
  ArrowRight,
  BadgeDollarSign,
  Bell,
  Building2,
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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

function getBadgeLabel(section: SettingsSection, canManage: boolean): string {
  if (section.status !== "available") {
    return "Coming Soon";
  }

  return canManage ? "Manage" : "View Only";
}

export function SettingsSectionCard({
  canManage,
  onOpen,
  section,
}: SettingsSectionCardProps): JSX.Element {
  const Icon = icons[section.iconName];
  const disabled = section.status === "disabled";
  const disabledReason = "This section is prepared for the next development phase.";

  return (
    <Card className="group/card overflow-hidden transition-colors hover:border-brand-caramel/60">
      <CardContent className="flex h-full flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-cappuccino/35 text-brand-caramel">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <Badge
            className={
              section.status === "disabled"
                ? "border-brand-cappuccino bg-brand-cappuccino/35 text-brand-mocha"
                : canManage
                  ? "border-brand-caramel/70 bg-brand-caramel/15 text-brand-mocha"
                  : "border-brand-cappuccino bg-brand-latte text-brand-mocha"
            }
          >
            {getBadgeLabel(section, canManage)}
          </Badge>
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <h3 className="text-lg font-semibold text-brand-espresso">{section.title}</h3>
          <p className="text-sm leading-6 text-brand-mocha">{section.description}</p>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex justify-end">
                <Button
                  aria-label={`${section.actionLabel} ${section.title}`}
                  className="group/action rounded-full"
                  disabled={disabled}
                  onClick={onOpen}
                  type="button"
                  variant="outline"
                >
                  <span className="sr-only">{canManage ? section.actionLabel : "View"}</span>
                  <ArrowRight
                    aria-hidden="true"
                    className="transition-transform duration-200 ease-out motion-reduce:transition-none group-hover/card:translate-x-1 group-focus-visible/action:translate-x-1"
                    data-icon="inline-end"
                  />
                </Button>
              </span>
            </TooltipTrigger>
            {disabled ? <TooltipContent>{disabledReason}</TooltipContent> : null}
          </Tooltip>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
