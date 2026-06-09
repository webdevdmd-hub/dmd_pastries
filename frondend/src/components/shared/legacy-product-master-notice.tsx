import { ArrowRight, Info } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";

type LegacyProductMasterNoticeProps = {
  kind: "ingredient" | "packaging";
};

const noticeCopy = {
  ingredient: {
    href: ROUTES.productsIngredients,
    label: "Product Master Ingredients",
    title: "Legacy ingredient compatibility view",
    description:
      "New ingredient records should be created in Product Master using product type Ingredient. This page remains available for existing legacy ingredient records only.",
  },
  packaging: {
    href: ROUTES.productsPackaging,
    label: "Product Master Packaging",
    title: "Legacy packaging compatibility view",
    description:
      "New packaging records should be created in Product Master using product type Packaging. This page remains available for existing legacy packaging records only.",
  },
} as const;

export function LegacyProductMasterNotice({ kind }: LegacyProductMasterNoticeProps): JSX.Element {
  const copy = noticeCopy[kind];

  return (
    <Card className="border-workspace-border bg-workspace-panel">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-workspace-border bg-brand-latte text-brand-espresso">
            <Info className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-brand-espresso">{copy.title}</p>
            <p className="mt-1 max-w-3xl text-sm text-brand-mocha">{copy.description}</p>
          </div>
        </div>
        <Button asChild className="shrink-0" type="button" variant="outline">
          <Link href={copy.href}>
            Open {copy.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
