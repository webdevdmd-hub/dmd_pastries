"use client";

import {
  ArrowRight,
  CheckCircle2,
  FileInput,
  FileText,
  PackageCheck,
  RotateCcwSquare,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType, JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import type { PurchasingSummary } from "@/types/purchasing";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

type LifecycleStage = {
  action: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  metric: string;
  step: string;
  tone: "active" | "neutral" | "warning";
};

const fallbackSummary: PurchasingSummary = {
  openPurchaseOrders: 0,
  purchasesThisMonth: 0,
  receivedThisMonth: 0,
  totalInvoices: 0,
  totalPurchaseOrders: 0,
  unpaidInvoiceAmount: 0,
};

function buildStages(summary?: PurchasingSummary): LifecycleStage[] {
  const data = summary ?? fallbackSummary;

  return [
    {
      action: "Open orders",
      description: "Start with supplier, branch, item lines, expected date, tax, and notes.",
      href: ROUTES.purchasingOrders,
      icon: FileText,
      label: "Purchase Order",
      metric: `${String(data.openPurchaseOrders)} open`,
      step: "01",
      tone: data.openPurchaseOrders > 0 ? "active" : "neutral",
    },
    {
      action: "Review bills",
      description: "Convert eligible POs into draft supplier bills without re-entering items.",
      href: ROUTES.purchasingInvoices,
      icon: FileInput,
      label: "Bill",
      metric: `${String(data.totalInvoices)} bills`,
      step: "02",
      tone: data.unpaidInvoiceAmount > 0 ? "warning" : "neutral",
    },
    {
      action: "Receive goods",
      description: "Receive goods from purchase orders and post stock into inventory.",
      href: ROUTES.purchasingReceipts,
      icon: PackageCheck,
      label: "Receive Goods",
      metric: formatCurrency(data.receivedThisMonth),
      step: "03",
      tone: "active",
    },
    {
      action: "Record payments",
      description: "Record outgoing payments made against posted bills and balances.",
      href: ROUTES.purchasingPayments,
      icon: WalletCards,
      label: "Payment Made",
      metric: formatCurrency(data.unpaidInvoiceAmount),
      step: "04",
      tone: data.unpaidInvoiceAmount > 0 ? "warning" : "neutral",
    },
    {
      action: "Vendor credits",
      description: "Return received items and create supplier credits linked to receipt/invoice.",
      href: ROUTES.purchasingReturns,
      icon: RotateCcwSquare,
      label: "Vendor Credit",
      metric: "Credit notes",
      step: "05",
      tone: "neutral",
    },
  ];
}

function toneClasses(tone: LifecycleStage["tone"]): string {
  if (tone === "warning") {
    return "border-warning/30 bg-warning-tint/70 text-warning-text";
  }

  if (tone === "active") {
    return "border-money/30 bg-money-tint/70 text-money-text";
  }

  return "border-brand-cappuccino bg-card text-brand-espresso";
}

function StageCard({ stage }: { stage: LifecycleStage }): JSX.Element {
  const Icon = stage.icon;

  return (
    <Link className="group block h-full" href={stage.href}>
      <article className="flex h-full flex-col gap-4 rounded-2xl border border-brand-cappuccino bg-card p-4 shadow-sm transition group-hover:-translate-y-0.5 group-hover:border-brand-caramel group-hover:shadow-float">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-latte text-brand-mocha">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-bold text-brand-mocha">Step {stage.step}</p>
              <h3 className="text-base font-bold text-brand-espresso">{stage.label}</h3>
            </div>
          </div>
          <Badge className={toneClasses(stage.tone)} variant="outline">
            {stage.metric}
          </Badge>
        </div>

        <p className="min-h-12 text-sm leading-6 text-brand-mocha">{stage.description}</p>

        <div className="mt-auto flex items-center justify-between border-t border-brand-cappuccino/70 pt-3">
          <span className="text-sm font-semibold text-brand-espresso">{stage.action}</span>
          <ArrowRight className="h-4 w-4 text-brand-mocha transition group-hover:translate-x-1 group-hover:text-brand-espresso" />
        </div>
      </article>
    </Link>
  );
}

export function PurchaseLifecycleBoard({
  summary,
}: {
  summary?: PurchasingSummary | undefined;
}): JSX.Element {
  const stages = buildStages(summary);

  return (
    <Card className="overflow-hidden border-brand-cappuccino bg-card/90 shadow-sm">
      <CardHeader className="border-b border-brand-cappuccino bg-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold text-brand-mocha">Purchase lifecycle</p>
            <CardTitle className="mt-2 text-2xl text-brand-espresso">
              Convert documents instead of re-entering them
            </CardTitle>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-mocha">
              Supplier, branch, items, units, quantities, rates, taxes, and notes move forward
              through each stage. Users only review, post, receive, pay, or return what changed.
            </p>
          </div>
          <Button asChild>
            <Link href={ROUTES.purchasingOrders}>Create purchase order</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 p-5">
        <div className="grid gap-4 xl:grid-cols-5">
          {stages.map((stage) => (
            <StageCard key={stage.step} stage={stage} />
          ))}
        </div>

        <div className="grid gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte/50 p-4 md:grid-cols-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-money-text" />
            <p className="text-sm text-brand-mocha">
              PO to bill creates a draft invoice and blocks duplicate conversion.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-money-text" />
            <p className="text-sm text-brand-mocha">
              Receive goods creates inventory only when the receiving record is posted.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-money-text" />
            <p className="text-sm text-brand-mocha">
              Payments made and vendor credits stay linked in the purchase timeline.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
