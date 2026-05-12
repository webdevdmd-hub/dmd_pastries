"use client";

import { Truck } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type SuppliersEmptyStateProps = {
  canManage: boolean;
  onCreate: () => void;
};

export function SuppliersEmptyState({
  canManage,
  onCreate,
}: SuppliersEmptyStateProps): JSX.Element {
  return (
    <Card className="bg-white/80">
      <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
        <Truck className="h-12 w-12 text-brand-mocha" />
        <div>
          <h2 className="text-2xl font-bold text-brand-espresso">No suppliers found.</h2>
          <p className="mt-2 max-w-xl text-sm text-brand-mocha">
            Create supplier profiles to prepare purchasing, procurement, and inventory intake.
          </p>
        </div>
        {canManage ? (
          <Button onClick={onCreate} type="button">
            Add Supplier
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
