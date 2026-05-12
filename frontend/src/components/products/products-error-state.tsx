"use client";

import { AlertTriangle } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ProductsErrorStateProps = {
  description: string;
  onRetry: () => void;
};

export function ProductsErrorState({ description, onRetry }: ProductsErrorStateProps): JSX.Element {
  return (
    <Card className="border-red-200 bg-red-50/70">
      <CardContent className="p-8 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-700">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="text-xl font-semibold text-brand-espresso">Unable to load products</h3>
        <p className="mx-auto mt-2 max-w-xl text-sm text-brand-mocha">{description}</p>
        <Button className="mt-4" onClick={onRetry} variant="outline">
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}
