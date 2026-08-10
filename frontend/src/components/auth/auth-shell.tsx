"use client";

import {
  ArrowUpRight,
  ChevronRight,
  Croissant,
  Layers3,
  LockKeyhole,
  Network,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { JSX, ReactNode } from "react";
import { useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { authenticatedHomeRoute } from "@/lib/auth/routes";

type AuthShellProps = {
  children: ReactNode;
  title: string;
  description: string;
};

const operatingSignals = [
  { label: "Branch context", value: "Scoped" },
  { label: "Role access", value: "Granular" },
  { label: "Session sync", value: "Secure" },
];

const platformNodes = [
  "POS",
  "Products",
  "Payments",
  "Customers",
  "Inventory",
  "Orders",
  "Recipes",
  "Branches",
];

export function AuthShell({ children, title, description }: AuthShellProps): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const isLoginPage = pathname === ROUTES.login;
  const isSignupPage = pathname === ROUTES.signup;
  const usesMinimalAuthLayout = isLoginPage || isSignupPage;

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

  if (usesMinimalAuthLayout) {
    return (
      <div className="min-h-screen bg-[#f4f4f1] text-[#191918]">
        <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-6 py-12 sm:px-8 lg:px-10">
          <section
            className={isSignupPage ? "w-full max-w-[44rem]" : "w-full max-w-[27rem]"}
            aria-labelledby="auth-heading"
          >
            <div className="mb-9">
              <p className="mb-3 text-xs font-semibold uppercase text-[#70706b]">Account access</p>
              <h1 className="text-3xl font-semibold leading-tight sm:text-4xl" id="auth-heading">
                {title}
              </h1>
              {!isSignupPage ? (
                <p className="mt-3 max-w-sm text-sm leading-6 text-[#666662]">{description}</p>
              ) : null}
            </div>

            {children}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050302] text-brand-latte">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(176,137,104,0.42),transparent_28%),radial-gradient(circle_at_78%_8%,rgba(243,233,215,0.16),transparent_26%),radial-gradient(circle_at_70%_78%,rgba(122,85,58,0.38),transparent_34%),linear-gradient(135deg,#060403_0%,#1b120d_48%,#050302_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(243,233,215,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(243,233,215,0.045)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(circle_at_center,black,transparent_76%)]" />
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <div className="auth-scanline" />

      <div className="relative mx-auto grid min-h-screen max-w-[100rem] lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden min-h-screen flex-col border-r border-white/10 px-10 py-8 xl:flex">
          <div className="space-y-10">
            <nav className="flex items-center justify-between rounded-full border border-white/10 bg-white/[0.065] px-4 py-3 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
              <Link className="group flex items-center gap-3" href={ROUTES.home}>
                <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-brand-latte/15 bg-brand-caramel/18 shadow-[0_0_45px_rgba(176,137,104,0.34)] transition group-hover:scale-105 group-hover:bg-brand-caramel/30">
                  <Croissant className="h-5 w-5 text-brand-latte" />
                </div>
                <div>
                  <p className="font-display text-xl leading-none text-brand-latte">KCHEF</p>
                  <p className="text-[0.65rem] uppercase tracking-[0.26em] text-brand-cappuccino/80">
                    Secure operations OS
                  </p>
                </div>
              </Link>
              <Button
                asChild
                className="rounded-full border-white/10 bg-white/[0.06] text-brand-latte hover:bg-white/[0.12]"
                size="sm"
                variant="outline"
              >
                <Link href={ROUTES.home}>
                  Foundation
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </nav>

            <div className="max-w-4xl space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-caramel/40 bg-brand-caramel/12 px-4 py-2 text-sm text-brand-latte shadow-[0_0_36px_rgba(176,137,104,0.22)] backdrop-blur-xl">
                <Sparkles className="h-4 w-4" />
                Premium access layer
              </div>
              <h1 className="font-sans text-6xl font-semibold leading-[0.94] tracking-[-0.07em] text-brand-latte xl:text-[6.4rem]">
                Enter the bakery operating cockpit with confidence.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-brand-latte/70">
                Login restores your Appwrite session, backend profile, current branch, granted
                permissions, and live workspace context without exposing operational control to the
                browser.
              </p>
            </div>

            <div className="grid max-w-3xl gap-4 md:grid-cols-3">
              {operatingSignals.map((signal) => (
                <div
                  className="auth-glass-card rounded-3xl border border-white/10 p-5"
                  key={signal.label}
                >
                  <p className="font-display text-3xl text-brand-latte">{signal.value}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-brand-cappuccino/75">
                    {signal.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-[0.96fr_0.82fr]">
            <div className="auth-glass-card rounded-[1.6rem] border border-white/10 p-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.24em] text-brand-cappuccino">
                    Workspace graph
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-brand-latte">
                    One secure entry point
                  </h2>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-brand-caramel/25 bg-brand-caramel/16">
                  <Network className="h-4 w-4 text-brand-caramel" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {platformNodes.map((node) => (
                  <div
                    className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-1.5 text-xs text-brand-latte/72"
                    key={node}
                  >
                    {node}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="auth-glass-card rounded-[1.6rem] border border-white/10 p-4">
                <ShieldCheck className="mb-3 h-4 w-4 text-brand-caramel" />
                <h2 className="text-sm font-semibold text-brand-latte">Backend-trusted session</h2>
                <p className="mt-2 text-xs leading-5 text-brand-latte/62">
                  Permissions, branch isolation, and profile state are synced from the backend.
                </p>
              </div>
              <div className="auth-glass-card rounded-[1.6rem] border border-white/10 p-4">
                <Layers3 className="mb-3 h-4 w-4 text-brand-caramel" />
                <h2 className="text-sm font-semibold text-brand-latte">Operational continuity</h2>
                <p className="mt-2 text-xs leading-5 text-brand-latte/62">
                  Return directly into POS, inventory, orders, purchasing, and production work.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
          <div className="w-full max-w-xl">
            <div className="mb-8 flex items-center justify-between xl:hidden">
              <Link className="flex items-center gap-3" href={ROUTES.home}>
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-brand-latte/15 bg-brand-caramel/24 text-brand-latte shadow-[0_0_34px_rgba(176,137,104,0.36)]">
                  <Croissant className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-2xl text-brand-latte">KCHEF</p>
                  <p className="text-xs text-brand-cappuccino">Secure operations OS</p>
                </div>
              </Link>
              <Badge className="border-white/10 bg-white/10 text-brand-latte">Secure</Badge>
            </div>

            <div className="auth-login-frame relative rounded-[2.1rem] border border-white/14 bg-white/[0.08] p-[1px] shadow-[0_40px_120px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
              <div className="rounded-[calc(2.1rem-1px)] bg-[#100c09]/86 p-5 backdrop-blur-2xl sm:p-7">
                <div className="mb-7 flex items-start justify-between gap-4 border-b border-white/10 pb-6">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-brand-caramel/30 bg-brand-caramel/12 px-3 py-1 text-[0.65rem] uppercase tracking-[0.22em] text-brand-cappuccino">
                      <ScanLine className="h-3.5 w-3.5" />
                      Access gateway
                    </div>
                    <div className="space-y-2">
                      <h2 className="font-sans text-4xl font-semibold leading-none tracking-[-0.055em] text-brand-latte sm:text-5xl">
                        {title}
                      </h2>
                      <p className="max-w-md text-sm leading-6 text-brand-latte/64">
                        {description}
                      </p>
                    </div>
                  </div>
                  <div className="hidden h-13 w-13 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-brand-latte/10 text-brand-latte shadow-[0_0_38px_rgba(243,233,215,0.13)] sm:flex">
                    <LockKeyhole className="h-5 w-5" />
                  </div>
                </div>

                {children}
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3 text-sm text-brand-latte/70">
              <Button
                asChild
                className="rounded-full border-white/10 bg-white/[0.08] text-brand-latte hover:bg-white/[0.14]"
                size="sm"
                variant="outline"
              >
                <Link href={ROUTES.login}>
                  Login
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                className="rounded-full text-brand-cappuccino hover:bg-white/[0.08] hover:text-brand-latte"
                size="sm"
                variant="ghost"
              >
                <Link href={ROUTES.signup}>
                  Create account
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
