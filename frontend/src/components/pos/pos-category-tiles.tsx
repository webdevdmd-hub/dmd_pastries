"use client";

import { LayoutGrid } from "lucide-react";
import type { JSX } from "react";

import { getProductCategoryIconForMetadata } from "@/lib/product-category-icons";
import type { ProductCategory } from "@/types/master-data";

type POSCategoryTilesProps = {
  categories: ProductCategory[];
  /** "row" scrolls sideways under the header; "column" fills the left rail. */
  layout: "column" | "row";
  onSelect: (categoryId: string) => void;
  selectedCategoryId: string;
};

/**
 * Category tiles: an icon over a label, the selected one raised.
 *
 * One component in both orientations so a category cannot look like two
 * different controls depending on the width of the till. Below lg it is a
 * scrolling row under the header; from lg it is the left rail, where a vertical
 * list stays hittable however many categories the business adds.
 *
 * Tiles are 4.5rem tall and at least that wide, over the 48px counter minimum.
 */
export function POSCategoryTiles({
  categories,
  layout,
  onSelect,
  selectedCategoryId,
}: POSCategoryTilesProps): JSX.Element {
  const isRow = layout === "row";
  const entries = [
    { icon: LayoutGrid, id: "all", label: "All" },
    ...categories.map((category) => ({
      icon: getProductCategoryIconForMetadata(category),
      id: category.id,
      label: category.categoryName,
    })),
  ];

  return (
    <div
      className={
        isRow
          ? "scrollbar-hidden flex gap-2 overflow-x-auto border-b border-border bg-card px-3 py-2.5"
          : "scrollbar-hidden flex h-full min-h-0 flex-col gap-2 overflow-y-auto border-r border-border bg-card p-2.5"
      }
      role="group"
      aria-label="Product categories"
    >
      {entries.map((entry) => {
        const Icon = entry.icon;
        const isSelected = selectedCategoryId === entry.id;

        return (
          <button
            aria-pressed={isSelected}
            className={`flex min-h-[4.5rem] shrink-0 flex-col items-center justify-center gap-1.5 rounded-lg border px-3 py-2 transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              isRow ? "min-w-[4.5rem]" : "w-full"
            } ${
              isSelected
                ? "border-foreground bg-muted text-foreground shadow-xs"
                : "border-border bg-card text-foreground-muted hover:-translate-y-px hover:text-foreground hover:shadow-sm"
            }`}
            key={entry.id}
            onClick={() => onSelect(entry.id)}
            type="button"
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="text-meta w-full truncate text-center font-medium">{entry.label}</span>
          </button>
        );
      })}
    </div>
  );
}
