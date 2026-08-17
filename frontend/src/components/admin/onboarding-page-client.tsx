"use client";

import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  CreditCard,
  type LucideIcon,
  MailCheck,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Store,
  Users,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { useBusinessProfile, useOnboardingStatus } from "@/hooks/use-business";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import type { OnboardingStepKey } from "@/types/business";

type OnboardingStepMetadata = {
  title: string;
  description: string;
  icon: LucideIcon;
  href?: string;
};

const onboardingStepMetadata: Record<OnboardingStepKey, OnboardingStepMetadata> = {
  business_profile: {
    title: "Verify company profile",
    description: "Confirm business name, VAT/TRN, currency, timezone, and workspace status.",
    icon: Building2,
    href: ROUTES.settings,
  },
  default_roles: {
    title: "Review default roles",
    description:
      "Confirm Admin, Manager, Cashier, and Inventory Clerk permissions before staff access.",
    icon: ShieldCheck,
    href: ROUTES.roles,
  },
  first_branch: {
    title: "Create first branch",
    description: "Set the main selling location and branch-specific operating details.",
    icon: Store,
    href: `${ROUTES.settings}/branches`,
  },
  business_settings: {
    title: "Receipt and tax setup",
    description: "Prepare receipt footer, tax defaults, stock rules, and business preferences.",
    icon: Receipt,
    href: ROUTES.settings,
  },
  staff_ready: {
    title: "Invite staff",
    description: "Invite or create staff accounts and assign them to the correct role and branch.",
    icon: Users,
    href: ROUTES.users,
  },
};

const supplementalSteps: OnboardingStepMetadata[] = [
  {
    title: "Verify owner email",
    description:
      "Confirm the owner email in Appwrite so recovery and account security work safely.",
    icon: MailCheck,
    href: ROUTES.verifyEmail,
  },
  {
    title: "Payment methods",
    description: "Prepare cash, card, split payment, and future online payment configuration.",
    icon: CreditCard,
    href: ROUTES.settings,
  },
  {
    title: "Ready for POS",
    description: "Open the POS shell once staff roles and branch context are ready.",
    icon: BadgeCheck,
    href: ROUTES.pos,
  },
];

export function OnboardingPageClient(): JSX.Element {
  const { user } = useAuth();
  const { hasPermission } = usePermission();
  const canViewSettings = hasPermission(PERMISSIONS.settingsView);
  const businessQuery = useBusinessProfile(canViewSettings);
  const onboardingQuery = useOnboardingStatus(canViewSettings);

  if (!canViewSettings) {
    return (
      <div className="mx-auto max-w-3xl">
        <Alert className="border-brand-cappuccino bg-white/80">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Business onboarding requires settings access</AlertTitle>
          <AlertDescription>
            You need the settings.view permission to load backend onboarding status.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Business Onboarding"
        description="Complete the backend-tracked operational setup needed before live selling, branch workflows, and staff rollout."
      />

      <Card className="overflow-hidden">
        <CardHeader className="bg-brand-cappuccino/30">
          <CardDescription>Workspace</CardDescription>
          <CardTitle className="font-serif text-3xl">
            {businessQuery.data?.businessName ?? user?.businessName ?? "Business workspace"}
          </CardTitle>
          {onboardingQuery.data ? (
            <div className="mt-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-brand-mocha">
                <span>{String(onboardingQuery.data.completionPercent)}% complete</span>
                <Badge
                  className={
                    onboardingQuery.data.complete
                      ? undefined
                      : "border-brand-mocha/30 bg-transparent text-brand-mocha"
                  }
                  variant={onboardingQuery.data.complete ? "secondary" : "default"}
                >
                  {onboardingQuery.data.complete ? "Complete" : "In progress"}
                </Badge>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-brand-latte">
                <div
                  className="h-full rounded-full bg-brand-caramel"
                  style={{ width: `${String(onboardingQuery.data.completionPercent)}%` }}
                />
              </div>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {businessQuery.error || onboardingQuery.error ? (
            <Alert className="border-red-200 bg-red-50 text-red-950">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Unable to load onboarding status</AlertTitle>
              <AlertDescription>
                {getErrorMessage(businessQuery.error ?? onboardingQuery.error)}
              </AlertDescription>
            </Alert>
          ) : null}

          {onboardingQuery.isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  className="min-h-56 animate-pulse rounded-3xl border border-brand-cappuccino bg-white/60"
                  key={`onboarding-skeleton-${String(index)}`}
                />
              ))}
            </div>
          ) : null}

          {onboardingQuery.data ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {onboardingQuery.data.steps.map((step) => {
                const metadata = onboardingStepMetadata[step.key];
                const Icon = metadata.icon;
                const StatusIcon = step.complete ? CheckCircle2 : XCircle;

                return (
                  <article
                    className="flex min-h-56 flex-col rounded-3xl border border-brand-cappuccino bg-white/70 p-5 shadow-soft"
                    key={step.key}
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="rounded-2xl bg-brand-cappuccino/50 p-3 text-brand-mocha">
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge
                        className={
                          step.complete
                            ? undefined
                            : "border-brand-mocha/30 bg-transparent text-brand-mocha"
                        }
                        variant={step.complete ? "secondary" : "default"}
                      >
                        <StatusIcon className="mr-1 h-3.5 w-3.5" />
                        {step.complete ? "Complete" : "Pending"}
                      </Badge>
                    </div>
                    <h2 className="text-lg font-semibold text-brand-espresso">{metadata.title}</h2>
                    <p className="mt-2 flex-1 text-sm leading-6 text-brand-mocha">
                      {metadata.description}
                    </p>
                    <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-brand-mocha/70">
                      Backend step: {step.label}
                    </p>
                    {metadata.href ? (
                      <Button asChild className="mt-5 w-full" variant="outline">
                        <Link href={metadata.href}>Open</Link>
                      </Button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : null}

          <div>
            <h2 className="font-serif text-2xl text-brand-espresso">Additional setup</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {supplementalSteps.map((step) => {
                const Icon = step.icon;

                return (
                  <article
                    className="flex min-h-48 flex-col rounded-3xl border border-brand-cappuccino bg-brand-latte/70 p-5"
                    key={step.title}
                  >
                    <div className="mb-4 w-fit rounded-2xl bg-brand-cappuccino/50 p-3 text-brand-mocha">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-brand-espresso">{step.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-6 text-brand-mocha">
                      {step.description}
                    </p>
                    {step.href ? (
                      <Button asChild className="mt-5 w-full" variant="outline">
                        <Link href={step.href}>Open</Link>
                      </Button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
