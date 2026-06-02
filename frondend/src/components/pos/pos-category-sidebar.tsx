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
    <aside className="scrollbar-hidden flex h-full flex-col items-stretch gap-2 overflow-y-auto border-r border-[#d4d4d8] bg-white px-2 py-4">
      <Button
        className={
          selectedCategoryId === "all"
            ? "h-16 flex-col gap-1 rounded-md border-black bg-black text-xs font-black text-white hover:bg-[#18181b]"
            : "h-16 flex-col gap-1 rounded-md border-[#d4d4d8] bg-white text-xs font-black text-[#3f3f46] hover:bg-[#f4f4f5]"
        }
        onClick={() => onSelect("all")}
        type="button"
        variant="outline"
      >
        <Archive className="h-5 w-5" />
        <span>All</span>
      </Button>
      {categories.map((category) => {
        const Icon = getProductCategoryIconForMetadata(category);

        return (
          <Button
            className={
              selectedCategoryId === category.id
                ? "h-16 flex-col gap-1 rounded-md border-black bg-black text-center text-white hover:bg-[#18181b]"
                : "h-16 flex-col gap-1 rounded-md border-[#d4d4d8] bg-white text-center text-[#3f3f46] hover:bg-[#f4f4f5]"
            }
            key={category.id}
            onClick={() => onSelect(category.id)}
            type="button"
            variant="outline"
          >
            <Icon className="h-5 w-5" />
            <span className="line-clamp-1 text-[0.68rem] font-bold">{category.categoryName}</span>
          </Button>
        );
      })}
    </aside>
  );
}
