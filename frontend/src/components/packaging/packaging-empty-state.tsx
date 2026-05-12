"use client";

import { PackageOpen } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type PackagingEmptyStateProps = {
  canManage: boolean;
  onCreate: () => void;
};

export function PackagingEmptyState({
  canManage,
  onCreate,
}: PackagingEmptyStateProps): JSX.Element {
  return (
    <Card className="bg-white/80">
      <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
        <PackageOpen className="h-12 w-12 text-brand-mocha" />
        <div>
          <h2 className="text-2xl font-bold text-brand-espresso">No packaging items found.</h2>
          <p className="mt-2 max-w-xl text-sm text-brand-mocha">
            Create boxes, cups, trays, labels, and other packaging used across products and orders.
          </p>
        </div>
        {canManage ? (
          <Button onClick={onCreate} type="button">
            Add Packaging
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
