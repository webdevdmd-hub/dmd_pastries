"use client";

import type { JSX, ReactNode } from "react";

import type { BatchDetailTabKey } from "@/components/manufacturing/batch-detail-tabs";
import {
  BATCH_DETAIL_TABPANEL_ID,
  BatchDetailViewTabs,
} from "@/components/manufacturing/batch-detail-view-tabs";
import { BatchIngredientsSection } from "@/components/manufacturing/batch-ingredients-section";
import { BatchOutputSection } from "@/components/manufacturing/batch-output-section";
import { BatchPackagingSection } from "@/components/manufacturing/batch-packaging-section";
import { BatchProgressCard } from "@/components/manufacturing/batch-progress-card";
import { BatchTimeline } from "@/components/manufacturing/batch-timeline";
import { BatchWastageSection } from "@/components/manufacturing/batch-wastage-section";
import { formatRecipeVersionLabel } from "@/lib/manufacturing/recipe-version-display";
import type {
  ProductionBatch,
  ProductionBatchIngredient,
  ProductionBatchPackaging,
  ProductionOutput,
  ProductionWastage,
} from "@/types/manufacturing";

export function formatBatchDateTime(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "Not set";
}

export function formatBatchQuantity(value: number, unit: string): string {
  return `${new Intl.NumberFormat("en-AE", { maximumFractionDigits: 2 }).format(value)} ${unit}`;
}

export function batchOutputLabel(batch: ProductionBatch): string {
  return batch.productVariantName
    ? `${batch.productName} - ${batch.productVariantName}`
    : batch.productName;
}

function InfoField({
  label,
  numeric = false,
  value,
}: {
  label: string;
  numeric?: boolean;
  value: ReactNode;
}): JSX.Element {
  return (
    <div className="min-w-0">
      <p className="text-meta text-foreground-muted">{label}</p>
      <p className={`mt-0.5 break-words text-cell font-medium ${numeric ? "tabular-nums" : ""}`}>
        {value}
      </p>
    </div>
  );
}

type BatchDetailsPanelProps = {
  activeTab: BatchDetailTabKey;
  batch: ProductionBatch;
  ingredients: ProductionBatchIngredient[];
  onTabChange: (tab: BatchDetailTabKey) => void;
  outputs: ProductionOutput[];
  packaging: ProductionBatchPackaging[];
  wastage: ProductionWastage[];
};

/**
 * The body of a production batch, shared by the drawer over the list and the
 * full page at /manufacturing/batches/[id]. One component so the two cannot
 * drift.
 */
export function BatchDetailsPanel({
  activeTab,
  batch,
  ingredients,
  onTabChange,
  outputs,
  packaging,
  wastage,
}: BatchDetailsPanelProps): JSX.Element {
  return (
    <div className="grid min-w-0 gap-6">
      <BatchDetailViewTabs
        active={activeTab}
        batchId={batch.id}
        ingredientsCount={ingredients.length}
        onTabChange={onTabChange}
        outputCount={outputs.length}
        packagingCount={packaging.length}
        wastageCount={wastage.length}
      />

      <div className="min-w-0" id={BATCH_DETAIL_TABPANEL_ID} role="tabpanel" tabIndex={-1}>
        {activeTab === "overview" ? (
          <div className="grid gap-4">
            <BatchProgressCard batch={batch} />

            <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
              <InfoField label="Output product" value={batchOutputLabel(batch)} />
              <InfoField
                label="Stock target"
                value={batch.productVariantName ? "Variant stock" : "Parent product stock"}
              />
              <InfoField
                label="Recipe"
                value={`${batch.recipeName} · ${formatRecipeVersionLabel(batch.recipeVersionNumber)}`}
              />
              <InfoField label="Branch" value={batch.branchName} />
              <InfoField
                label="Planned"
                numeric
                value={formatBatchQuantity(batch.plannedQuantity, batch.batchUnitName)}
              />
              <InfoField
                label="Produced"
                numeric
                value={formatBatchQuantity(batch.producedQuantity, batch.batchUnitName)}
              />
              <InfoField label="Start time" numeric value={formatBatchDateTime(batch.startTime)} />
              <InfoField label="End time" numeric value={formatBatchDateTime(batch.endTime)} />
            </div>

            {/* The timeline is the other half of "how far has this got", so it
                belongs beside the progress bar rather than in a narrow rail
                three sections down the page. */}
            <BatchTimeline batch={batch} />

            {batch.notes ? (
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-meta text-foreground-muted">Notes</p>
                <p className="mt-1 text-cell">{batch.notes}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "ingredients" ? <BatchIngredientsSection ingredients={ingredients} /> : null}

        {activeTab === "packaging" ? <BatchPackagingSection packaging={packaging} /> : null}

        {activeTab === "output" ? <BatchOutputSection outputs={outputs} /> : null}

        {activeTab === "wastage" ? <BatchWastageSection wastage={wastage} /> : null}
      </div>
    </div>
  );
}
