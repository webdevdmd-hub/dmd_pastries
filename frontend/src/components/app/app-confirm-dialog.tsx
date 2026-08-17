"use client";

import { type JSX, type ReactNode, useRef } from "react";

import { AppButton } from "@/components/app/app-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Confirmation before something irreversible. Plan item C0.6; design drawn in
 * docs/design/preview-states.html.
 *
 * This component existed before with zero call sites while 11 `window.confirm`
 * calls did the real work. Four things changed, each of which was a way for a
 * cashier to confirm the wrong thing:
 *
 * 1. BUTTON ORDER WAS INVERTED. Cancel rendered first and Confirm last, so
 *    DialogFooter's justify-end put the *destructive* action at the rightmost
 *    position — the natural thumb rest on a counter touchscreen. The safe action
 *    now sits last and takes initial focus, so a stray Enter or a blind tap keeps
 *    the sale.
 * 2. LABELS DEFAULTED TO "Cancel" / "Confirm". Generic labels are what make a
 *    confirm dialog reflexive; you dismiss it without reading. Both labels are
 *    now REQUIRED and must name the action ("Keep sale" / "Void sale").
 * 3. NOTHING REQUIRED THE CONSEQUENCE. `description` was free-form, so
 *    "Are you sure?" type-checked. `consequence` is required and is meant to
 *    carry the identifier and the amount — the two things a cashier checks
 *    against the receipt in their hand.
 * 4. NO ALERTDIALOG SEMANTICS. Now `role="alertdialog"`. Dismissing via Escape or
 *    an outside click stays allowed, because dismissing is the safe outcome.
 *
 * Sizing comes from the density register: `min-h-tap` resolves to 48px inside the
 * Counter register and 32px in Ledger. That only works because DialogContent
 * re-stamps `data-density` onto its portalled content — see
 * components/density/density-provider.tsx.
 */
type AppConfirmDialogProps = {
  /** Names the safe action, e.g. "Keep sale". Never "Cancel". */
  cancelLabel: string;
  /** Names the destructive action, e.g. "Void sale". Never "Confirm". */
  confirmLabel: string;
  /** What will happen, including the identifier and the amount. Required. */
  consequence: ReactNode;
  /** Optional tinted row for a secondary effect, e.g. the reversing entry. */
  detail?: ReactNode;
  isSubmitting?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: ReactNode;
  tone?: "danger" | "default";
};

export function AppConfirmDialog({
  cancelLabel,
  confirmLabel,
  consequence,
  detail,
  isSubmitting = false,
  onConfirm,
  onOpenChange,
  open,
  title,
  tone = "danger",
}: AppConfirmDialogProps): JSX.Element {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-w-md gap-3"
        // Focus the SAFE action explicitly. React's `autoFocus` is not enough:
        // Radix fires onOpenAutoFocus after mount and moves focus to the first
        // tabbable element, which is the destructive button. The two raced, and the
        // safe button only won by accident — it held focus when the dialog opened
        // from a plain button, and lost it when the dialog opened from a dropdown
        // menu. Since "a stray Enter keeps the sale" is the entire safety argument
        // for this component, it cannot rest on ordering luck.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
        role="alertdialog"
        showCloseButton={false}
      >
        <DialogHeader className="gap-2">
          <DialogTitle className="text-title">{title}</DialogTitle>
          <DialogDescription className="text-body text-foreground-muted">
            {consequence}
          </DialogDescription>
        </DialogHeader>

        {detail ? (
          <div
            className={`text-meta flex items-center gap-2 rounded-md px-3 py-2 ${
              tone === "danger"
                ? "bg-danger-tint text-danger-text"
                : "bg-muted text-foreground-muted"
            }`}
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                tone === "danger" ? "bg-danger" : "bg-foreground-muted"
              }`}
            />
            {detail}
          </div>
        ) : null}

        {/* Destructive first in the DOM, safe action last. justify-end then puts
            the safe action rightmost, and autoFocus makes it the default. */}
        <DialogFooter className="gap-2 sm:justify-end">
          <AppButton
            className="min-h-tap text-body px-4 font-medium"
            disabled={isSubmitting}
            onClick={onConfirm}
            tone={tone === "danger" ? "danger" : "default"}
            type="button"
            variant="outline"
          >
            {confirmLabel}
          </AppButton>
          <AppButton
            className="min-h-tap text-body border-border bg-card px-4 font-medium text-foreground hover:bg-muted"
            onClick={() => onOpenChange(false)}
            ref={cancelRef}
            type="button"
            variant="outline"
          >
            {cancelLabel}
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
