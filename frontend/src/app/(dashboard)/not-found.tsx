import Link from "next/link";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

/**
 * Lives inside the (dashboard) group so it renders within DashboardShell.
 *
 * Before this file existed there was no not-found.tsx at any level, so every
 * 404 in an authenticated ERP fell through to Next's stock page: black on
 * white, no sidebar, no branding, and no way back other than the browser
 * button. Keeping the shell means the operator can simply carry on.
 *
 * The copy borrows the reassurance FailedState established -- an address that
 * does not resolve is not a sign that anything was lost -- but this is not a
 * failure, so it does not use the danger treatment.
 */
export default function DashboardNotFound(): JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-14 text-center">
        <p className="text-meta text-foreground-muted">404</p>
        <h1 className="text-page text-foreground">That page isn&rsquo;t here</h1>
        <p className="text-body max-w-[52ch] text-foreground-muted">
          The address may be mistyped, or the record it pointed at was removed. Nothing has changed
          and no data was lost.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button asChild className="min-h-tap">
            <Link href={ROUTES.dashboard}>Go to the dashboard</Link>
          </Button>
          <Button asChild className="min-h-tap" variant="outline">
            <Link href={ROUTES.reports}>Browse reports</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
