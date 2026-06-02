import type { JSX } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type AppButtonTone = "default" | "admin" | "pos" | "success" | "warning" | "danger";

type AppButtonProps = ButtonProps & {
  tone?: AppButtonTone;
};

const toneClasses: Record<AppButtonTone, string> = {
  default: "",
  admin: "bg-brand-espresso text-white shadow-none hover:bg-brand-mocha",
  pos: "min-h-12 rounded-xl text-base shadow-none",
  success: "bg-emerald-700 text-white hover:bg-emerald-800",
  warning: "bg-amber-700 text-white hover:bg-amber-800",
  danger: "bg-red-700 text-white hover:bg-red-800",
};

export function AppButton({
  className,
  tone = "default",
  variant,
  ...props
}: AppButtonProps): JSX.Element {
  return <Button className={cn(toneClasses[tone], className)} variant={variant} {...props} />;
}
