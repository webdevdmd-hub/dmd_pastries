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
        "sticky top-0 hidden h-screen shrink-0 border-r transition-[width,background-color,border-color,color] duration-300 lg:flex lg:flex-col",
        "border-workspace-border bg-[#f4f4f5] text-brand-espresso shadow-none",
        collapsed ? "w-[4.75rem]" : "w-[18rem]",
      )}
    >
      <div
        className={cn(
          "flex min-h-20 items-center gap-3 border-b px-4",
          "border-workspace-border bg-workspace-panel",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-xl font-semibold tracking-tight text-brand-espresso">
              COCKPIT
            </p>
            <p className="mt-1 text-[0.68rem] uppercase tracking-[0.28em] text-workspace-sidebar-muted">
              Operations OS
            </p>
          </div>
        ) : null}
        <Button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "h-10 w-10 rounded-2xl",
            "border-workspace-border bg-workspace-panel text-brand-espresso shadow-none hover:bg-[#f4f4f5]",
          )}
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
        <nav aria-label="Primary" className="flex min-h-0 flex-1 px-2 py-4">
          <AppNavigationList collapsed={collapsed} theme="pos" />
        </nav>
      </TooltipProvider>

      {!collapsed ? (
        <div className="mx-3 mb-4 rounded-2xl border border-workspace-border bg-workspace-panel p-3 text-xs text-workspace-sidebar-muted">
          <p className="font-medium text-brand-espresso">Protected workspace</p>
          <p className="mt-1.5 leading-5">Branch-aware modules grouped by operating workflow.</p>
        </div>
      ) : null}
    </aside>
  );
}
