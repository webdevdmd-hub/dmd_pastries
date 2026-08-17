"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Circle,
  Croissant,
  ReceiptText,
  X,
} from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { useOnboardingStatus } from "@/hooks/use-business";
import { useProducts } from "@/hooks/use-products";
import { cn } from "@/lib/utils/cn";
import type { ProductListFilters } from "@/types/product";

const STORAGE_PREFIX = "pos.getting-started";

// Minimal list request used only to read the catalog total.
const PRODUCT_COUNT_FILTERS: ProductListFilters = {
  search: "",
  categoryId: "all",
  productType: "all",
  itemStructure: "all",
  status: "all",
  isPosVisible: "all",
  isSellable: "all",
  isPurchasable: "all",
  page: 1,
  limit: 1,
  sortBy: "created_at",
  sortOrder: "desc",
};

type ChecklistStep = {
  key: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: LucideIcon;
  complete: boolean;
};

function readFlag(key: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Ignore unavailable storage (e.g. privacy mode).
  }
}

type GettingStartedChecklistProps = {
  hasFirstSale: boolean;
};

export function GettingStartedChecklist({
  hasFirstSale,
}: GettingStartedChecklistProps): JSX.Element | null {
  const { user } = useAuth();
  const businessId = user?.businessId ?? "default";
  const dismissedKey = `${STORAGE_PREFIX}.dismissed:${businessId}`;
  const graduatedKey = `${STORAGE_PREFIX}.graduated:${businessId}`;

  const [hydrated, setHydrated] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [graduated, setGraduated] = useState(false);

  // Read persisted state once the business is known (client only).
  useEffect(() => {
    setDismissed(readFlag(dismissedKey));
    setGraduated(readFlag(graduatedKey));
    setHydrated(true);
  }, [dismissedKey, graduatedKey]);

  const active = hydrated && !dismissed && !graduated;
  const onboardingQuery = useOnboardingStatus(active);
  const productsQuery = useProducts(PRODUCT_COUNT_FILTERS, active);

  // Default unknown/blocked signals to "complete" so we never nag the user with
  // a step they cannot see or act on (e.g. missing settings/products access).
  const setupComplete = onboardingQuery.data ? onboardingQuery.data.complete : true;
  const hasProduct = productsQuery.data
    ? productsQuery.data.total > 0
    : Boolean(productsQuery.error);

  const steps = useMemo<ChecklistStep[]>(
    () => [
      {
        key: "business_setup",
        title: "Finish business setup",
        description: "Confirm your profile, branch, roles, and receipt settings.",
        href: ROUTES.onboarding,
        cta: "Review setup",
        icon: Building2,
        complete: setupComplete,
      },
      {
        key: "first_product",
        title: "Add your first product",
        description: "Create a catalog item so it can be sold at the POS.",
        href: ROUTES.products,
        cta: "Add product",
        icon: Croissant,
        complete: hasProduct,
      },
      {
        key: "first_sale",
        title: "Make your first sale",
        description: "Open the POS and complete a billing session.",
        href: ROUTES.pos,
        cta: "Open POS",
        icon: ReceiptText,
        complete: hasFirstSale,
      },
    ],
    [hasFirstSale, hasProduct, setupComplete],
  );

  const completedCount = steps.filter((step) => step.complete).length;
  const allComplete = completedCount === steps.length;

  // Once everything is done, retire the card permanently for this business so it
  // never reappears in a later period with no sales.
  useEffect(() => {
    if (active && allComplete) {
      writeFlag(graduatedKey);
      setGraduated(true);
    }
  }, [active, allComplete, graduatedKey]);

  if (!active || allComplete) {
    return null;
  }

  const progressPercent = Math.round((completedCount / steps.length) * 100);

  const handleDismiss = (): void => {
    writeFlag(dismissedKey);
    setDismissed(true);
  };

  return (
    <section className="overflow-hidden rounded-md border border-workspace-border bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-workspace-border px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-brand-espresso">Get your bakery ready</h2>
          <p className="mt-1 text-sm text-workspace-muted">
            {completedCount} of {steps.length} steps done — finish these to start selling.
          </p>
        </div>
        <button
          aria-label="Dismiss getting started"
          className="rounded-md p-1 text-foreground-muted transition-colors hover:bg-muted hover:text-brand-espresso"
          onClick={handleDismiss}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="h-1.5 w-full bg-brand-latte">
        <div
          className="h-full bg-brand-caramel transition-all"
          style={{ width: `${String(progressPercent)}%` }}
        />
      </div>

      <ol>
        {steps.map((step) => {
          const StepIcon = step.icon;
          const StatusIcon = step.complete ? CheckCircle2 : Circle;

          return (
            <li
              className="flex items-center gap-4 border-b border-workspace-border px-5 py-3.5 last:border-b-0"
              key={step.key}
            >
              <StatusIcon
                className={cn(
                  "h-5 w-5 shrink-0",
                  step.complete ? "text-brand-caramel" : "text-foreground-muted",
                )}
              />
              <span className="hidden rounded-lg bg-brand-latte/70 p-2 text-brand-mocha sm:block">
                <StepIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-sm font-semibold",
                    step.complete ? "text-workspace-muted line-through" : "text-brand-espresso",
                  )}
                >
                  {step.title}
                </span>
                <span className="mt-0.5 block truncate text-xs text-workspace-muted">
                  {step.description}
                </span>
              </span>
              {step.complete ? (
                <span className="text-xs font-semibold uppercase text-brand-caramel">Done</span>
              ) : (
                <Button asChild size="sm" variant="outline">
                  <Link href={step.href}>
                    {step.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
