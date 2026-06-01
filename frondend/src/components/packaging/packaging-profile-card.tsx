"use client";

import { Boxes, PackageSearch } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { PackagingStatusBadge } from "@/components/packaging/packaging-status-badge";
import { ReorderLevelHeader } from "@/components/shared/reorder-level-help";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { getProductImagePreviewUrl } from "@/lib/appwrite/storage";
import type { PackagingItem } from "@/types/packaging";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "Not recorded";
}

function Detail({
  label,
  value,
}: {
  label: string | JSX.Element;
  value: string | JSX.Element;
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-brand-mocha">{label}</p>
      <div className="mt-1 font-semibold text-brand-espresso">{value}</div>
    </div>
  );
}

export function PackagingProfileCard({ item }: { item: PackagingItem }): JSX.Element {
  const imageUrl = getProductImagePreviewUrl(item.imageFileId) ?? item.imageUrl;

  return (
    <Card className="bg-white/80">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{item.packagingName}</CardTitle>
            <p className="mt-1 text-sm text-brand-mocha">{item.packagingCode}</p>
          </div>
          <PackagingStatusBadge status={item.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {imageUrl ? (
          <img
            alt={item.packagingName}
            className="h-48 w-full rounded-2xl object-cover"
            src={imageUrl}
          />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-2xl border border-brand-cappuccino bg-brand-latte/70">
            <Boxes className="h-12 w-12 text-brand-mocha" />
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <Detail label="Category" value={item.packagingCategoryName} />
          <Detail label="Supplier" value={item.supplierName ?? "Not linked"} />
          <Detail label="Unit" value={`${item.unitName} (${item.unitSymbol})`} />
          <Detail label="Cost" value={formatCurrency(item.costPerUnit)} />
          <Detail
            label="Stock tracked"
            value={
              <Badge variant="outline">{item.isStockTracked ? "Tracked" : "Not tracked"}</Badge>
            }
          />
          <Detail
            label="Consumable"
            value={<Badge variant="outline">{item.isConsumable ? "Consumable" : "Reusable"}</Badge>}
          />
          <Detail
            label={<ReorderLevelHeader>Reorder level</ReorderLevelHeader>}
            value={`${String(item.reorderLevel)} ${item.unitSymbol}`}
          />
          <Detail label="Created" value={formatDate(item.createdAt)} />
        </div>

        <div className="rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-brand-mocha">Inventory Link</p>
          {item.isStockTracked ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-brand-espresso">
                Stock is tracked for this packaging item. Use Inventory to view current branch
                quantity.
              </p>
              <Button asChild type="button" variant="outline">
                <Link href={`${ROUTES.inventory}?search=${encodeURIComponent(item.packagingName)}`}>
                  <PackageSearch className="h-4 w-4" />
                  Open Inventory
                </Link>
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-brand-mocha">
              Inventory tracking is disabled for this packaging item.
            </p>
          )}
        </div>

        {item.description ? (
          <div className="rounded-2xl border border-brand-cappuccino bg-brand-latte/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-brand-mocha">Description</p>
            <p className="mt-2 text-sm leading-6 text-brand-espresso">{item.description}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
