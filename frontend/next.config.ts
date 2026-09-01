import path from "node:path";

import type { NextConfig } from "next";

import { ROUTES } from "./src/constants/routes";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  /**
   * Pin the workspace root to this directory.
   *
   * Turbopack walks upwards looking for lockfiles to infer the root. A stray
   * package-lock.json in the user's home directory outranked our own
   * pnpm-lock.yaml, so the inferred root became the home directory and every
   * externalised server dependency was resolved against a node_modules that
   * only ever held two unrelated packages -- "Cannot find module
   * 'lucide-react'" on an install that was perfectly intact. Pinning the root
   * removes the guess.
   */
  turbopack: {
    root: path.join(__dirname),
  },
  /**
   * Index and legacy routes that only ever forwarded somewhere else.
   *
   * These were page components whose whole body was `redirect(...)`, which
   * means React renders a component, that component immediately throws
   * NEXT_REDIRECT to unwind, and the browser makes a second request. In dev it
   * also broke the RSC render tracing: Next names a performance measure after
   * the component, the throw skips the end mark, and the overlay reports
   * "'PurchasingPage' cannot have a negative time stamp".
   *
   * Answering at the HTTP layer skips React entirely. Nothing renders, nothing
   * throws, and there is no RSC payload for a page with no content.
   *
   * `permanent: false` (307) on purpose: browsers cache a 308 aggressively and
   * these are internal routes that may well grow real pages later.
   */
  redirects() {
    return Promise.resolve([
      { destination: ROUTES.purchasingOrders, permanent: false, source: "/purchasing" },
      {
        destination: ROUTES.purchasingReturns,
        permanent: false,
        source: "/purchasing/vendor-credits",
      },
      { destination: ROUTES.expenses, permanent: false, source: "/purchasing/expenses" },
      { destination: ROUTES.manufacturingBatches, permanent: false, source: "/manufacturing" },
      {
        destination: ROUTES.reportsInventoryAudit,
        permanent: false,
        source: "/inventory/audit",
      },
    ]);
  },
};

export default nextConfig;
