"use client";

import { ShieldAlert } from "lucide-react";
import type { JSX } from "react";

import { Card, CardContent } from "@/components/ui/card";

export function ProductsAccessDeniedCard(): JSX.Element {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-cappuccino/40 text-brand-caramel">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold text-brand-espresso">Access denied</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-brand-mocha">
          You do not have permission to view Products.
        </p>
      </CardContent>
    </Card>
  );
}
