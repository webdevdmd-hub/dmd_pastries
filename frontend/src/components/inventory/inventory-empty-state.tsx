import { PackageOpen, Plus } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type InventoryEmptyStateProps = {
  canManage?: boolean;
  onCreate?: () => void;
  title?: string;
  description?: string;
};

export function InventoryEmptyState({
  canManage = false,
  onCreate,
  title = "No inventory items found.",
  description = "Create opening stock to begin tracking branch-level product quantities.",
}: InventoryEmptyStateProps): JSX.Element {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <PackageOpen className="h-10 w-10 text-brand-mocha" />
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-brand-espresso">{title}</h2>
          <p className="max-w-md text-sm text-brand-mocha">{description}</p>
        </div>
        {canManage && onCreate ? (
          <Button onClick={onCreate} type="button">
            <Plus className="h-4 w-4" />
            Opening Stock
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
