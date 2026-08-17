"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { JSX, ReactNode } from "react";
import { useEffect } from "react";

import { LedgerMotif } from "@/components/auth/ledger-motif";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { authenticatedHomeRoute } from "@/lib/auth/routes";

/**
 * Shell for all six auth routes, on the Threshold register (DESIGN.md §7, plan
 * item D5): the form on `--card`, paired with the ledger motif on a `--muted`
 * field.
 *
 * ONE LAYOUT, WHERE THERE WERE TWO
 *
 * This previously branched. Login and signup got a plain centred column; the other
 * four got a marketing layout with a 6.4rem headline ("Enter the bakery operating
 * cockpit with confidence"), a glass-card grid of "operating signals", and a
 * "workspace graph" of module names. Two consequences worth naming:
 *
 * - The elaborate half rendered on verify-email and accept-invitation — screens
 *   reached from an email link by someone who has ALREADY decided — while the two
 *   screens a prospect actually judges got the plain one. Exactly backwards.
 * - It was 54 hardcoded hexes and ~90 lines of copy nobody maintained.
 *
 * Signup keeps a wider column because its form is genuinely longer; that is the only
 * per-route difference left, and it is a width, not a layout.
 *
 * WHY THE MOTIF SITS BESIDE THE FORM RATHER THAN BEHIND IT
 *
 * Behind the form is where the orbs were, and anything back there competes with the
 * fields for attention while adding nothing to the task. Beside it, on its own
 * `--muted` panel, it is legible as what it is — a statement about the product — and
 * the form keeps an uncontested `--card` surface. It also drops out entirely below
 * `lg`, where the form should have the whole screen.
 */
type AuthShellProps = {
  children: ReactNode;
  title: string;
  description: string;
};

export function AuthShell({ children, title, description }: AuthShellProps): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const isSignupPage = pathname === ROUTES.signup;

  useEffect(() => {
    if (
      isAuthenticated &&
      user &&
      pathname !== ROUTES.verifyEmail &&
      pathname !== ROUTES.acceptInvitation
    ) {
      // Use the same home-route resolution as the login form so both redirects
      // agree (platform admins go straight to super-admin, no hop chain).
      router.replace(authenticatedHomeRoute(user));
    }
  }, [isAuthenticated, pathname, router, user]);

  return (
    <div className="min-h-screen bg-canvas text-foreground">
      <div
        className={`mx-auto grid min-h-screen ${
          isSignupPage ? "max-w-[72rem]" : "max-w-[64rem]"
        } lg:grid-cols-[1fr_0.85fr]`}
      >
        <main className="flex items-center bg-card px-6 py-12 sm:px-10 lg:px-14">
          <section
            aria-labelledby="auth-heading"
            className={`w-full ${isSignupPage ? "max-w-[38rem]" : "max-w-[26rem]"}`}
          >
            {/* The wordmark is the whole of the bakery identity now (DESIGN.md §1),
                and threshold surfaces are the only place it appears. */}
            <Link className="font-serif text-title text-foreground" href={ROUTES.home}>
              Pastries POS
            </Link>

            <h1 className="text-page mt-8 text-foreground" id="auth-heading">
              {title}
            </h1>

            {/* Signup's own form carries its explanation, so repeating it here just
                pushed the first field further down the screen. */}
            {!isSignupPage ? (
              <p className="text-body mt-3 max-w-[46ch] text-foreground-muted">{description}</p>
            ) : null}

            <div className="mt-9">{children}</div>
          </section>
        </main>

        <LedgerMotif />
      </div>
    </div>
  );
}
