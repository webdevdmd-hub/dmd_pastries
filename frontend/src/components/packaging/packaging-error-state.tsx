"use client";

import { AlertTriangle } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type PackagingErrorStateProps = {
  description: string;
  onRetry: () => void;
};

export function PackagingErrorState({
  description,
  onRetry,
}: PackagingErrorStateProps): JSX.Element {
  return (
    <Card className="border-danger/30 bg-danger-tint/80">
      <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
        <AlertTriangle className="h-10 w-10 text-danger-text" />
        <div>
          <h2 className="text-2xl font-bold text-brand-espresso">Unable to load packaging</h2>
          <p className="mt-2 text-sm text-brand-mocha">{description}</p>
        </div>
        <Button onClick={onRetry} type="button" variant="outline">
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}
