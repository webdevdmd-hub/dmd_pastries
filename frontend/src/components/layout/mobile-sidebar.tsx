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
import { useAuth } from "@/hooks/use-auth";

export function MobileSidebar(): JSX.Element {
  // Was a hardcoded "KCHEF" — see desktop-sidebar.tsx.
  const { user } = useAuth();
  const workspaceName = user?.businessName ?? "Workspace";

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
        className="flex w-[20rem] flex-col border-workspace-border bg-muted p-4 text-brand-espresso sm:w-[22rem]"
        side="left"
      >
        <SheetHeader>
          <SheetTitle className="truncate text-left text-xl font-semibold leading-none text-brand-espresso">
            {workspaceName}
          </SheetTitle>
          <SheetDescription className="text-left text-xs text-workspace-muted">
            Operations OS
          </SheetDescription>
        </SheetHeader>
        <div className="mt-5 w-fit rounded-full border border-workspace-border bg-workspace-panel px-3 py-1 text-xs font-semibold text-brand-espresso">
          Operations shell
        </div>

        <nav aria-label="Primary" className="mt-6 flex min-h-0 flex-1">
          <TooltipProvider delayDuration={150}>
            <AppNavigationList theme="pos" />
          </TooltipProvider>
        </nav>

        <div className="rounded-2xl border border-workspace-border bg-workspace-panel p-3 text-xs text-workspace-muted">
          <p className="font-medium text-brand-espresso">Protected workspace</p>
          <p className="mt-1.5 leading-5">Modules stay grouped by operating workflow.</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
