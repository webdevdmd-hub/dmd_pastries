"use client";

import type { JSX } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type RecipeYieldPreview = {
  batchYieldQuantity: number | "";
  batchYieldUnitName: string | null;
  preparationTimeMinutes: number | null;
};

function formattedPreparationTime(value: number | null): string {
  return `${String(Number.isFinite(value) ? value : 0)} minutes`;
}

export function RecipeYieldCard({ preview }: { preview: RecipeYieldPreview }): JSX.Element {
  const batchYield =
    preview.batchYieldQuantity !== "" && preview.batchYieldUnitName
      ? `${String(preview.batchYieldQuantity)} ${preview.batchYieldUnitName}`
      : "Not saved";

  return (
    <Card className="bg-card/80">
      <CardHeader>
        <CardTitle>Yield</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm text-brand-mocha">
        <div className="flex justify-between">
          <span>Batch yield</span>
          <strong className="text-brand-espresso">{batchYield}</strong>
        </div>
        <div className="flex justify-between">
          <span>Preparation time</span>
          <strong className="text-brand-espresso">
            {formattedPreparationTime(preview.preparationTimeMinutes)}
          </strong>
        </div>
      </CardContent>
    </Card>
  );
}
