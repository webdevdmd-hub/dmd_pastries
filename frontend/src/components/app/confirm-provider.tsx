"use client";

import {
  createContext,
  type JSX,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { AppConfirmDialog } from "@/components/app/app-confirm-dialog";

/**
 * Promise-based confirmation, so replacing `window.confirm` is a near drop-in.
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ ... }))) return;
 *
 * WHY NOT JUST KEEP window.confirm
 *
 * There were 11 of them, and they were the app's real confirmation surface. On a
 * counter touchscreen a native OS dialog is the wrong instrument:
 *
 * - It cannot show the amount or the identifier, so a cashier confirms "Clear
 *   current POS cart?" with no idea whether that is 2 items or 20.
 * - Its buttons are OS-sized and OS-positioned. Nothing guarantees 48px, and
 *   nothing guarantees the safe action is the one under the thumb.
 * - "OK" does not name the action, which is exactly what makes a confirm reflexive.
 * - It blocks the main thread.
 * - Most seriously: some kiosk and installed-PWA contexts suppress `window.confirm`
 *   entirely. There it returns false — or, depending on the engine, the call is
 *   simply skipped — so a destructive action either silently never runs or runs
 *   with no prompt at all. A till is precisely the kind of locked-down display
 *   where that happens, and it fails silently.
 *
 * Escape and outside-click resolve false. Dismissing is the safe outcome, so the
 * accidental gesture is the harmless one.
 */
type ConfirmRequest = {
  cancelLabel: string;
  confirmLabel: string;
  consequence: ReactNode;
  detail?: ReactNode;
  title: ReactNode;
  tone?: "danger" | "default";
};

type ConfirmFn = (request: ConfirmRequest) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

type PendingConfirm = {
  request: ConfirmRequest;
  resolve: (confirmed: boolean) => void;
};

export function ConfirmProvider({ children }: Readonly<{ children: ReactNode }>): JSX.Element {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (request) =>
      new Promise<boolean>((resolve) => {
        setPending({ request, resolve });
      }),
    [],
  );

  const settle = useCallback((confirmed: boolean) => {
    setPending((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending ? (
        <AppConfirmDialog
          cancelLabel={pending.request.cancelLabel}
          confirmLabel={pending.request.confirmLabel}
          consequence={pending.request.consequence}
          detail={pending.request.detail}
          onConfirm={() => settle(true)}
          onOpenChange={(open) => {
            if (!open) {
              settle(false);
            }
          }}
          open
          title={pending.request.title}
          tone={pending.request.tone ?? "danger"}
        />
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);

  if (!confirm) {
    throw new Error("useConfirm must be used inside a ConfirmProvider.");
  }

  return confirm;
}
