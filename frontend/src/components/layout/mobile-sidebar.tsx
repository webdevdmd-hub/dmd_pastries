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
import { useWorkspaceName } from "@/hooks/use-workspace-name";

export function MobileSidebar(): JSX.Element {
  // Was a hardcoded "KCHEF" — see desktop-sidebar.tsx.
  const workspaceName = useWorkspaceName();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          aria-label="Open navigation"
          className="border-border bg-workspace-panel text-foreground shadow-none hover:bg-muted/70"
          size="icon"
          variant="outline"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open navigation</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        className="flex w-[20rem] flex-col border-border bg-muted p-4 text-foreground sm:w-[22rem]"
        side="left"
      >
        <SheetHeader>
          <SheetTitle className="truncate text-left text-xl font-semibold leading-none text-foreground">
            {workspaceName}
          </SheetTitle>
          <SheetDescription className="text-left text-xs text-foreground-muted">
            Operations OS
          </SheetDescription>
        </SheetHeader>
        <nav aria-label="Primary" className="mt-6 flex min-h-0 flex-1">
          <TooltipProvider delayDuration={150}>
            <AppNavigationList theme="pos" />
          </TooltipProvider>
        </nav>

        <div className="rounded-lg border border-border bg-workspace-panel p-3 text-xs text-foreground-muted">
          <p className="font-medium text-foreground">Protected workspace</p>
          <p className="mt-1.5 leading-5">Modules stay grouped by operating workflow.</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
