import { toast } from "sonner";

import { getErrorMessage } from "@/lib/api/client";

/**
 * Report a failed money mutation.
 *
 * Two rules from UI-REBUILD-PLAN C0.7, both of which the plain
 * `toast.error(getErrorMessage(error))` pattern broke:
 *
 * 1. It must lead with the money verdict. "Request failed with status 409" does
 *    not tell a cashier the one thing they need to know, which is whether the
 *    customer was charged. The server detail is demoted to description.
 *
 * 2. It must persist until acknowledged. The global Toaster sets no duration, so
 *    a failure vanished after about four seconds — long enough to miss while
 *    looking at the customer, and then the screen looks like nothing happened.
 *    `duration: Infinity` plus an explicit Dismiss makes the cashier close it,
 *    which is the acknowledgement.
 *
 * @param verdict What happened to the money, in the user's terms. Always state
 *   the outcome, never the operation: "No payment was taken", not "Add payment
 *   failed".
 */
export function toastMoneyFailure(verdict: string, error: unknown): void {
  toast.error(verdict, {
    description: getErrorMessage(error),
    duration: Number.POSITIVE_INFINITY,
    action: {
      label: "Dismiss",
      onClick: () => {
        // Closing it is the acknowledgement; sonner dismisses on action click.
      },
    },
  });
}
