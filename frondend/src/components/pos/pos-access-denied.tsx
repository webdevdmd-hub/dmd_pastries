import { ShieldAlert } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";

export function POSAccessDenied(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-latte p-6">
      <Card className="max-w-lg border-brand-cappuccino bg-white/90 text-center shadow-xl">
        <CardContent className="space-y-4 p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-700">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <div>
            <h1 className="font-display text-3xl text-brand-espresso">POS access denied</h1>
            <p className="mt-2 text-sm text-brand-mocha">
              You do not have permission to open POS Billing.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
