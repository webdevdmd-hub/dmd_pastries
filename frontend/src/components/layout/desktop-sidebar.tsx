"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";

import { AppNavigationList } from "@/components/layout/app-navigation-list";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";

export function DesktopSidebar(): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 border-r border-brand-latte/10 bg-brand-espresso text-brand-latte shadow-panel transition-[width] duration-300 lg:flex lg:flex-col",
        collapsed ? "w-[5.75rem]" : "w-[19rem]",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 border-b border-brand-latte/10 p-5",
          collapsed ? "justify-center px-3" : "justify-between",
        )}
      >
        {!collapsed ? (
          <div>
            <p className="font-display text-3xl leading-none text-brand-latte">COCKPIT</p>
            <p className="mt-1 text-xs uppercase tracking-[0.22em] text-brand-latte/55">
              Operations OS
            </p>
          </div>
        ) : null}
        <Button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="border-brand-latte/15 bg-brand-latte/5 text-brand-latte hover:bg-brand-latte/10"
          size="icon"
          type="button"
          variant="outline"
          onClick={() => setCollapsed((current) => !current)}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      <TooltipProvider delayDuration={150}>
        <nav aria-label="Primary" className="flex min-h-0 flex-1 px-3 py-5">
          <AppNavigationList collapsed={collapsed} />
        </nav>
      </TooltipProvider>

      {!collapsed ? (
        <div className="m-4 rounded-3xl border border-brand-latte/10 bg-brand-latte/5 p-4 text-sm text-brand-latte/75">
          <p className="font-medium text-brand-latte">Branch-aware navigation</p>
          <p className="mt-2 leading-6">
            Modules stay grouped by workflow, with Reports expanded into focused analytics areas.
          </p>
        </div>
      ) : null}
    </aside>
  );
}
