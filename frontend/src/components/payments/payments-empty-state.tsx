import { WalletCards } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";

type PaymentsEmptyStateProps = {
  title?: string;
  description?: string;
};

export function PaymentsEmptyState({
  title = "No payments found.",
  description = "Payments will appear here once POS sales or split payments are recorded.",
}: PaymentsEmptyStateProps): JSX.Element {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-cappuccino/30 text-brand-caramel">
          <WalletCards className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold text-brand-espresso">{title}</h2>
        <p className="max-w-xl text-sm leading-6 text-brand-mocha">{description}</p>
      </CardContent>
    </Card>
  );
}
