"use client";

import type { JSX, ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type AppSheetProps = {
  children: ReactNode;
  description?: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  side?: "left" | "right" | "top" | "bottom";
  title: ReactNode;
};

export function AppSheet({
  children,
  description,
  onOpenChange,
  open,
  side = "right",
  title,
}: AppSheetProps): JSX.Element {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="overflow-y-auto" side={side}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? (
            <SheetDescription>{description}</SheetDescription>
          ) : (
            <SheetDescription className="sr-only">
              Review the details and actions in this panel.
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="mt-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
