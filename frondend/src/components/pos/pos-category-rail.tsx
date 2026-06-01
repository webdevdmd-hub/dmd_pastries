import { CakeSlice, Coffee, Croissant, IceCreamBowl, Package } from "lucide-react";
import type { JSX } from "react";

import { Button } from "@/components/ui/button";

const categories = [
  { label: "Pastries", icon: Croissant },
  { label: "Cakes", icon: CakeSlice },
  { label: "Coffee", icon: Coffee },
  { label: "Desserts", icon: IceCreamBowl },
  { label: "Packaging", icon: Package },
] as const;

export function PosCategoryRail(): JSX.Element {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2" aria-label="Prepared POS categories">
      {categories.map((category) => {
        const Icon = category.icon;

        return (
          <Button
            className="shrink-0 rounded-2xl border-brand-cappuccino bg-white/70"
            key={category.label}
            type="button"
            variant="outline"
          >
            <Icon className="h-4 w-4 text-brand-caramel" />
            {category.label}
          </Button>
        );
      })}
    </div>
  );
}
