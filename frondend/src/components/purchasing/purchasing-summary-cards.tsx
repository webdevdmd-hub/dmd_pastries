import { FileText, PackageCheck, Receipt, WalletCards } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";
import type { PurchasingSummary } from "@/types/purchasing";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

const fallbackSummary: PurchasingSummary = {
  openPurchaseOrders: 0,
  purchasesThisMonth: 0,
  receivedThisMonth: 0,
  totalInvoices: 0,
  totalPurchaseOrders: 0,
  unpaidInvoiceAmount: 0,
};

export function PurchasingSummaryCards({
  summary,
}: {
  summary?: PurchasingSummary | undefined;
}): JSX.Element {
  const data = summary ?? fallbackSummary;
  const cards = [
    {
      icon: FileText,
      label: "Total Purchase Orders",
      value: String(data.totalPurchaseOrders),
    },
    {
      icon: PackageCheck,
      label: "Open Purchase Orders",
      value: String(data.openPurchaseOrders),
    },
    {
      icon: WalletCards,
      label: "Unpaid Invoice Amount",
      value: formatCurrency(data.unpaidInvoiceAmount),
    },
    {
      icon: Receipt,
      label: "Received This Month",
      value: formatCurrency(data.receivedThisMonth),
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card className="bg-white/85" key={card.label}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-brand-mocha">{card.label}</p>
                <p className="mt-3 text-3xl font-semibold text-brand-espresso">{card.value}</p>
              </div>
              <div className="rounded-2xl bg-brand-latte p-3 text-brand-mocha">
                <Icon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
