import { History } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";

type MovementsEmptyStateProps = {
  description?: string;
  title?: string;
};

export function MovementsEmptyState({
  description = "Stock changes will appear after opening stock, manual movements, POS sales, purchases, or reversals.",
  title = "No stock movements found.",
}: MovementsEmptyStateProps): JSX.Element {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <History className="h-10 w-10 text-brand-mocha" />
        <h2 className="text-xl font-bold text-brand-espresso">{title}</h2>
        <p className="max-w-lg text-sm text-brand-mocha">{description}</p>
      </CardContent>
    </Card>
  );
}
