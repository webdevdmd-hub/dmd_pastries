import { forwardRef } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type AppButtonTone = "default" | "admin" | "pos" | "success" | "warning" | "danger";

type AppButtonProps = ButtonProps & {
  tone?: AppButtonTone;
};

/**
 * Tones on the v3 token layer (DESIGN.md §3, §6).
 *
 * `danger` and `warning` are deliberately NOT filled. A solid red button reads as
 * the primary action and invites the tap it exists to slow down, so destructive
 * intent lives in the text colour with the tint arriving on hover. `success` is
 * the `commit` variant: money-committing actions only, and one per screen.
 *
 * Safe to retokenize — `tone` had zero call sites across the app when this
 * changed, so nothing shifted visually.
 */
const toneClasses: Record<AppButtonTone, string> = {
  default: "",
  admin: "bg-primary text-primary-foreground shadow-none hover:bg-primary/90",
  pos: "min-h-tap text-body rounded shadow-none",
  success: "bg-money text-primary-foreground hover:bg-money-hover",
  warning: "border-border bg-card text-warning-text hover:border-warning hover:bg-warning-tint",
  danger: "border-border bg-card text-danger-text hover:border-danger hover:bg-danger-tint",
};

/**
 * Forwards its ref. `ui/Button` already did; this wrapper was swallowing it, which
 * made AppButton unusable anywhere focus has to be moved deliberately — the
 * safe-action focus on a destructive confirm being the case that surfaced it — and
 * would equally have broken tooltip and popover anchors.
 */
export const AppButton = forwardRef<HTMLButtonElement, AppButtonProps>(function AppButton(
  { className, tone = "default", variant, ...props },
  ref,
) {
  return (
    <Button className={cn(toneClasses[tone], className)} ref={ref} variant={variant} {...props} />
  );
});
