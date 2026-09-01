import { Archive } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { getProductCategoryIconForMetadata } from "@/lib/product-category-icons";
import type { ProductCategory } from "@/types/master-data";

type POSCategorySidebarProps = {
  categories: ProductCategory[];
  onSelect: (categoryId: string) => void;
  selectedCategoryId: string;
};

export function POSCategorySidebar({
  categories,
  onSelect,
  selectedCategoryId,
}: POSCategorySidebarProps): JSX.Element {
  return (
    <aside className="scrollbar-hidden flex h-full flex-col items-stretch gap-2 overflow-y-auto border-r border-border bg-card px-2.5 py-3">
      <Button
        className={
          selectedCategoryId === "all"
            ? "h-14 justify-start gap-2 rounded-md border-black bg-primary px-3 text-meta font-medium text-primary-foreground hover:bg-primary"
            : "h-14 justify-start gap-2 rounded-md border-border bg-card px-3 text-meta font-medium text-foreground-muted hover:bg-muted"
        }
        onClick={() => onSelect("all")}
        type="button"
        variant="outline"
      >
        <Archive className="h-5 w-5 shrink-0" />
        <span className="text-left">All</span>
      </Button>
      {categories.map((category) => {
        const Icon = getProductCategoryIconForMetadata(category);

        return (
          <Button
            className={
              selectedCategoryId === category.id
                ? "h-14 justify-start gap-2 rounded-md border-black bg-primary px-3 text-primary-foreground hover:bg-primary"
                : "h-14 justify-start gap-2 rounded-md border-border bg-card px-3 text-foreground-muted hover:bg-muted"
            }
            key={category.id}
            onClick={() => onSelect(category.id)}
            type="button"
            variant="outline"
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="whitespace-normal text-left text-meta font-medium leading-tight">
              {category.categoryName}
            </span>
          </Button>
        );
      })}
    </aside>
  );
}
