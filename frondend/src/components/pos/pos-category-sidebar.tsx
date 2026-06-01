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
    <aside className="scrollbar-hidden flex h-full flex-col gap-2 overflow-y-auto rounded-[1.7rem] border border-brand-cappuccino/70 bg-white/70 p-3 shadow-[0_20px_60px_rgba(59,42,34,0.07)] backdrop-blur">
      <p className="px-1 text-xs font-bold uppercase tracking-[0.18em] text-brand-mocha">
        Category
      </p>
      <Button
        className="h-16 flex-col gap-1.5 rounded-2xl border-brand-cappuccino text-xs"
        onClick={() => onSelect("all")}
        type="button"
        variant={selectedCategoryId === "all" ? "default" : "ghost"}
      >
        <Archive className="h-5 w-5" />
        <span>All products</span>
      </Button>
      {categories.map((category) => {
        const Icon = getProductCategoryIconForMetadata(category);

        return (
          <Button
            className="h-16 flex-col gap-1.5 rounded-2xl border-brand-cappuccino text-center"
            key={category.id}
            onClick={() => onSelect(category.id)}
            type="button"
            variant={selectedCategoryId === category.id ? "default" : "ghost"}
          >
            <Icon className="h-5 w-5" />
            <span className="line-clamp-1 text-xs font-bold">{category.categoryName}</span>
          </Button>
        );
      })}
    </aside>
  );
}
