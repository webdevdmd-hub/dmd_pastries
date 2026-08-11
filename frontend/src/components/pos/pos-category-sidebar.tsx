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
    <aside className="scrollbar-hidden flex h-full flex-col items-stretch gap-2 overflow-y-auto border-r border-zinc-300 bg-white px-2.5 py-3">
      <Button
        className={
          selectedCategoryId === "all"
            ? "h-14 justify-start gap-2 rounded-md border-black bg-black px-3 text-xs font-black text-white hover:bg-zinc-900"
            : "h-14 justify-start gap-2 rounded-md border-zinc-300 bg-white px-3 text-xs font-black text-zinc-700 hover:bg-zinc-100"
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
                ? "h-14 justify-start gap-2 rounded-md border-black bg-black px-3 text-white hover:bg-zinc-900"
                : "h-14 justify-start gap-2 rounded-md border-zinc-300 bg-white px-3 text-zinc-700 hover:bg-zinc-100"
            }
            key={category.id}
            onClick={() => onSelect(category.id)}
            type="button"
            variant="outline"
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="whitespace-normal text-left text-[0.72rem] font-bold leading-tight">
              {category.categoryName}
            </span>
          </Button>
        );
      })}
    </aside>
  );
}
