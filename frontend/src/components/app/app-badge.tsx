import type { ComponentPropsWithoutRef, JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

type AppBadgeTone = "default" | "success" | "warning" | "danger" | "muted" | "info";

type AppBadgeProps = ComponentPropsWithoutRef<typeof Badge> & {
  tone?: AppBadgeTone;
};

const toneClasses: Record<AppBadgeTone, string> = {
  default: "",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-red-200 bg-red-50 text-red-800",
  muted: "border-brand-cappuccino bg-brand-latte text-brand-mocha",
  info: "border-brand-cappuccino bg-brand-cappuccino/30 text-brand-espresso",
};

export function AppBadge({
  className,
  tone = "default",
  variant = "outline",
  ...props
}: AppBadgeProps): JSX.Element {
  return <Badge className={cn(toneClasses[tone], className)} variant={variant} {...props} />;
}
