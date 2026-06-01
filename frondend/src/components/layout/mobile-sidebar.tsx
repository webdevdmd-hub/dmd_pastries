"use client";

import { Menu } from "lucide-react";
import type { JSX } from "react";

import { AppNavigationList } from "@/components/layout/app-navigation-list";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";

export function MobileSidebar(): JSX.Element {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          aria-label="Open navigation"
          className="border-workspace-border bg-workspace-panel text-brand-espresso shadow-none hover:bg-brand-latte/70"
          size="icon"
          variant="outline"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open navigation</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        className="flex w-[20rem] flex-col border-white/10 bg-workspace-sidebar p-4 text-white sm:w-[22rem]"
        data-sidebar-theme="pistachio"
        side="left"
      >
        <SheetHeader>
          <SheetTitle className="text-left text-xl font-semibold leading-none text-white">
            COCKPIT
          </SheetTitle>
          <SheetDescription className="text-left text-xs uppercase tracking-[0.22em] text-workspace-sidebar-muted">
            Operations OS
          </SheetDescription>
        </SheetHeader>
        <div className="mt-5 w-fit rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-white">
          Operations shell
        </div>

        <nav aria-label="Primary" className="mt-6 flex min-h-0 flex-1">
          <TooltipProvider delayDuration={150}>
            <AppNavigationList />
          </TooltipProvider>
        </nav>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs text-workspace-sidebar-muted">
          <p className="font-medium text-white">Protected workspace</p>
          <p className="mt-1.5 leading-5">Modules stay grouped by operating workflow.</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
