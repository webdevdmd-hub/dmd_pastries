import type { ComponentPropsWithoutRef, JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

type AppBadgeTone = "default" | "success" | "warning" | "danger" | "muted" | "info";

type AppBadgeProps = ComponentPropsWithoutRef<typeof Badge> & {
  tone?: AppBadgeTone;
};

const toneClasses: Record<AppBadgeTone, string> = {
  default: "",
  success: "border-money/30 bg-money-tint text-money-text",
  warning: "border-warning/30 bg-warning-tint text-warning-text",
  danger: "border-danger/30 bg-danger-tint text-danger-text",
  muted: "border-workspace-border bg-brand-latte text-workspace-muted",
  info: "border-workspace-border bg-workspace-panel text-brand-espresso",
};

export function AppBadge({
  className,
  tone = "default",
  variant = "outline",
  ...props
}: AppBadgeProps): JSX.Element {
  return <Badge className={cn(toneClasses[tone], className)} variant={variant} {...props} />;
}
