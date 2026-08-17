"use client";

import { createContext, type JSX, type ReactNode, useContext } from "react";

/**
 * Density registers (DESIGN.md §1).
 *
 * `counter` — a cashier standing at a till with someone waiting. 48px targets.
 * `ledger`  — an owner or accountant reading 20+ report screens. 36px controls.
 *
 * WHY A CONTEXT AND NOT JUST THE DOM ATTRIBUTE
 *
 * `[data-density="counter"]` on the (pos) layout div sets --control-h, --field-h
 * and --tap-min for everything *inside that div*. Radix portals its overlays —
 * dialog, sheet, popover, select, dropdown-menu — to document.body, which is
 * outside it. Portalled content therefore inherits :root's ledger values and
 * renders 36px controls on a touchscreen, silently: the custom properties still
 * resolve, just to the wrong register.
 *
 * That was true of all six POS dialogs, including pos-checkout-dialog, which is
 * where money is actually taken. So "no tap target under 48px in the Counter
 * register" was false on the highest-risk screen in the app.
 *
 * Stamping the attribute on <html> would also work and is one line, but it
 * breaks the moment a counter surface renders inside a dashboard route (or the
 * reverse). The register is a property of the subtree, so it travels with React
 * context and gets re-stamped onto the portal content.
 *
 * See UI-REBUILD-PLAN §9.1.
 */
export type Density = "counter" | "ledger";

/** Defaults to ledger: 146 of 147 routes are Ledger, and a wrong 36px is safer
 *  than a wrong 48px, which would blow up dense table layouts. */
const DensityContext = createContext<Density>("ledger");

export function DensityProvider({
  children,
  value,
}: Readonly<{ children: ReactNode; value: Density }>): JSX.Element {
  return <DensityContext.Provider value={value}>{children}</DensityContext.Provider>;
}

/**
 * Read the current register. Portalled primitives spread this onto their content
 * as `data-density` so the token layer resolves to the right register.
 */
export function useDensity(): Density {
  return useContext(DensityContext);
}
