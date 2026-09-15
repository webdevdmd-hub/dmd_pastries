import Link from "next/link";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

// Regression: ISSUE-002 — unknown routes rendered Next's default "404 This
// page could not be found." with no wordmark and no way back into the app.
// Found by /qa on 2026-09-14. This is a server component on purpose: it needs
// no session, so a signed-out visitor who mistypes a URL still gets a real
// page, and the dashboard link lets the auth wall decide where they land.
export default function NotFound(): JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md text-center">
        <p className="font-serif text-title leading-none">Pastries POS</p>
        <p className="text-meta mt-8 font-mono text-foreground-muted">404</p>
        <h1 className="text-page mt-2">This page does not exist</h1>
        <p className="text-body mt-3 text-foreground-muted">
          The address may be mistyped, or the page may have moved. Nothing has been lost.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href={ROUTES.dashboard}>Back to dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={ROUTES.home}>Go to the front page</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
