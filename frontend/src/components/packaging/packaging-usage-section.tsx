"use client";

import { Plus, Trash2 } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCreatePackagingUsage,
  useDeletePackagingUsage,
  usePackagingUsage,
} from "@/hooks/use-packaging";
import { getErrorMessage } from "@/lib/api/client";
import { createPackagingUsageSchema } from "@/lib/validators/packaging.schema";
import type { PackagingItem } from "@/types/packaging";

type PackagingUsageSectionProps = {
  canManage: boolean;
  item: PackagingItem;
};

export function PackagingUsageSection({
  canManage,
  item,
}: PackagingUsageSectionProps): JSX.Element {
  const [productId, setProductId] = useState("");
  const [activeProductId, setActiveProductId] = useState("");
  const [quantityRequired, setQuantityRequired] = useState("1");
  const [isDefault, setIsDefault] = useState(false);
  const usageQuery = usePackagingUsage(activeProductId, activeProductId.length > 0);
  const createMutation = useCreatePackagingUsage();
  const deleteMutation = useDeletePackagingUsage();
  const rules = usageQuery.data ?? [];
  const duplicateRule = rules.some((rule) => rule.packagingItemId === item.id);

  const loadRules = (): void => {
    setActiveProductId(productId.trim());
  };

  const createRule = async (): Promise<void> => {
    const parsed = createPackagingUsageSchema.safeParse({
      packagingItemId: item.id,
      quantityRequired,
      isDefault,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid packaging rule.");
      return;
    }

    if (!activeProductId) {
      toast.error("Enter a product ID before adding a usage rule.");
      return;
    }

    if (duplicateRule) {
      toast.error("This packaging item is already assigned to the selected product.");
      return;
    }

    try {
      await createMutation.mutateAsync({ productId: activeProductId, payload: parsed.data });
      toast.success("Packaging usage rule created.");
      setQuantityRequired("1");
      setIsDefault(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Card className="bg-card/80">
      <CardHeader>
        <CardTitle>Packaging usage rules</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-brand-mocha">
          The backend manages packaging rules by product. Enter a product ID to load and manage that
          product's packaging rules.
        </p>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <Input
            aria-label="Product ID"
            onChange={(event) => setProductId(event.target.value)}
            placeholder="Product ID"
            value={productId}
          />
          <Button onClick={loadRules} type="button" variant="outline">
            Load rules
          </Button>
        </div>

        {activeProductId ? (
          <div className="rounded-2xl border border-brand-cappuccino bg-brand-latte/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-brand-espresso">Selected product</p>
                <p className="text-xs text-brand-mocha">{activeProductId}</p>
              </div>
              {canManage ? (
                <div className="grid gap-3 md:grid-cols-[10rem_auto_auto]">
                  <label className="grid gap-1">
                    <Label htmlFor="usage-quantity">Quantity</Label>
                    <Input
                      id="usage-quantity"
                      min="0.01"
                      onChange={(event) => setQuantityRequired(event.target.value)}
                      step="0.01"
                      type="number"
                      value={quantityRequired}
                    />
                  </label>
                  <label className="flex items-end gap-2 pb-3 text-sm font-medium text-brand-espresso">
                    <Checkbox
                      checked={isDefault}
                      onCheckedChange={(checked) => setIsDefault(checked === true)}
                    />
                    Default
                  </label>
                  <Button
                    className="self-end"
                    disabled={createMutation.isPending || duplicateRule}
                    onClick={() => {
                      void createRule();
                    }}
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                    Add rule
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {usageQuery.isLoading ? <p className="text-sm text-brand-mocha">Loading rules...</p> : null}
        {!usageQuery.isLoading && activeProductId && rules.length === 0 ? (
          <p className="text-sm text-brand-mocha">No packaging rules for this product.</p>
        ) : null}
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte/70 p-4"
              key={rule.id}
            >
              <div>
                <p className="font-semibold text-brand-espresso">{rule.packagingName}</p>
                <p className="text-sm text-brand-mocha">
                  {rule.quantityRequired} required / {rule.isDefault ? "Default" : "Optional"}
                </p>
              </div>
              {canManage ? (
                <Button
                  aria-label="Delete packaging usage rule"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    void deleteMutation.mutateAsync({
                      productId: activeProductId,
                      ruleId: rule.id,
                    });
                  }}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="h-4 w-4 text-danger-text" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
