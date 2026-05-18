import { CircleHelp } from "lucide-react";
import type { JSX, ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";

const REORDER_LEVEL_HELP_TEXT =
  "Reorder Level defines the minimum stock quantity at which the system should alert or suggest reordering this item.";

type ReorderLevelHelpIconProps = {
  className?: string;
};

export function ReorderLevelHelpIcon({ className }: ReorderLevelHelpIconProps): JSX.Element {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            aria-label="What is reorder level?"
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded-full text-brand-mocha transition hover:bg-brand-cappuccino/40 hover:text-brand-espresso focus:outline-none focus:ring-2 focus:ring-brand-caramel",
              className,
            )}
            type="button"
          >
            <CircleHelp className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs leading-relaxed">
          {REORDER_LEVEL_HELP_TEXT}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

type ReorderLevelLabelProps = {
  children?: ReactNode;
  className?: string;
  htmlFor?: string;
};

export function ReorderLevelLabel({
  children = "Reorder level",
  className,
  htmlFor,
}: ReorderLevelLabelProps): JSX.Element {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{children}</Label>
      <ReorderLevelHelpIcon />
    </span>
  );
}

type ReorderLevelHeaderProps = {
  children?: ReactNode;
  className?: string;
};

export function ReorderLevelHeader({
  children = "Reorder Level",
  className,
}: ReorderLevelHeaderProps): JSX.Element {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span>{children}</span>
      <ReorderLevelHelpIcon />
    </span>
  );
}
