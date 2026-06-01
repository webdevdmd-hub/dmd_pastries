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
        "sticky top-0 hidden h-screen shrink-0 border-r border-white/10 bg-workspace-sidebar text-white shadow-workspace transition-[width] duration-300 lg:flex lg:flex-col",
        collapsed ? "w-[4.75rem]" : "w-[18rem]",
      )}
    >
      <div
        className={cn(
          "flex min-h-20 items-center gap-3 border-b border-white/10 px-4",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-xl font-semibold tracking-tight text-white">COCKPIT</p>
            <p className="mt-1 text-[0.68rem] uppercase tracking-[0.28em] text-workspace-sidebar-muted">
              Operations OS
            </p>
          </div>
        ) : null}
        <Button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="h-10 w-10 rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10"
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
          <AppNavigationList collapsed={collapsed} />
        </nav>
      </TooltipProvider>

      {!collapsed ? (
        <div className="mx-3 mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs text-workspace-sidebar-muted">
          <p className="font-medium text-white">Protected workspace</p>
          <p className="mt-1.5 leading-5">Branch-aware modules grouped by operating workflow.</p>
        </div>
      ) : null}
    </aside>
  );
}
