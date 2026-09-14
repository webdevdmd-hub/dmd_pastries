import type { OrderStatus } from "@/types/orders";

/**
 * What a bakery order is allowed to become, mirroring the server.
 *
 * The server is the authority. `allowedStatusTransition` in
 * backend/internal/modules/bakeryorders/service.go permits exactly three
 * things: staying put, cancelling from any status, and stepping ONE place
 * along new -> confirmed -> in_production -> ready -> delivered -> completed.
 * No skipping, and nothing ever leaves `cancelled`.
 *
 * Two copies of this rule had already drifted from it in different directions:
 *
 *   - order-details-panel rendered a flat list of all six statuses and
 *     disabled only the current one, so every order offered five buttons of
 *     which at most two worked. A cancelled order offered five that all failed.
 *   - order-actions-menu had a map, but it let `ready` jump to `completed`
 *     (the server refuses: ready may only become delivered) and it dropped
 *     `cancelled` from `completed`, hiding a transition the server supports
 *     and has explicit restock-and-reverse handling for.
 *
 * So there is one map now, and both components read it.
 *
 * Cancelling is offered wherever the server accepts the transition. It can
 * still be refused at the next gate: an order holding unrefunded advances,
 * or a completed order with post-completion refunds, is blocked by the W6
 * cancellation guard with a message saying what to do first. That guard needs
 * money state this map cannot see, which is why it stays on the server.
 *
 * Regression: ISSUE-004 — order status buttons offered transitions the server refuses
 * Found by /qa on 2026-09-14
 */
const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  cancelled: null,
  completed: null,
  confirmed: "in_production",
  delivered: "completed",
  in_production: "ready",
  new: "confirmed",
  ready: "delivered",
};

/**
 * The statuses an order in `from` may actually be moved to, in the order they
 * should be offered: the single step forward, then cancel.
 */
export function allowedOrderTransitions(from: OrderStatus): OrderStatus[] {
  const next = NEXT_STATUS[from];
  const transitions: OrderStatus[] = [];
  if (next) {
    transitions.push(next);
  }
  if (from !== "cancelled") {
    transitions.push("cancelled");
  }
  return transitions;
}

/**
 * Whether the order's contents can still be edited.
 *
 * Mirrors `orderCanEdit` on the server, which is also what `Update` enforces:
 * "completed or cancelled orders cannot be edited". The edit dialog used to
 * open regardless, so the whole multi-tab form could be filled in and only
 * the save told the user it was never possible.
 */
export function canEditOrder(status: OrderStatus): boolean {
  return status === "new" || status === "confirmed";
}

/**
 * Whether a payment can still be recorded against the order.
 *
 * Mirrors `AddPayment`, which refuses a cancelled order outright.
 */
export function canAddOrderPayment(status: OrderStatus): boolean {
  return status !== "cancelled";
}
