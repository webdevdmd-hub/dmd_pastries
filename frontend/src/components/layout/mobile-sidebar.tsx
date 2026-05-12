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
          className="border-brand-cappuccino bg-white/45 text-brand-espresso hover:bg-brand-cappuccino/35"
          size="icon"
          variant="outline"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open navigation</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        className="flex w-[20rem] flex-col border-brand-espresso/10 bg-brand-espresso p-5 text-brand-latte sm:w-[22rem]"
        data-sidebar-theme="pistachio"
        side="left"
      >
        <SheetHeader>
          <SheetTitle className="text-left font-display text-4xl leading-none text-brand-latte">
            Pastries POS
          </SheetTitle>
          <SheetDescription className="text-left text-brand-latte/70">
            Protected dashboard navigation for your bakery workspace.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 w-fit rounded-full border border-brand-caramel/20 bg-brand-caramel/20 px-3 py-1 text-xs font-semibold text-brand-latte">
          Operations shell
        </div>

        <nav aria-label="Primary" className="mt-8 flex min-h-0 flex-1">
          <TooltipProvider delayDuration={150}>
            <AppNavigationList />
          </TooltipProvider>
        </nav>

        <div className="rounded-3xl border border-brand-latte/10 bg-brand-latte/5 p-4 text-sm text-brand-latte/75">
          <p className="font-medium text-brand-latte">Warm, controlled operations</p>
          <p className="mt-2 leading-6">
            Access, roles, settings, and POS modules stay grouped under one protected menu.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
