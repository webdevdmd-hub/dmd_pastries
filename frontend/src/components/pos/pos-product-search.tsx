import { Search } from "lucide-react";
import type { JSX } from "react";

import { Input } from "@/components/ui/input";

type POSProductSearchProps = {
  onChange: (value: string) => void;
  value: string;
};

export function POSProductSearch({ onChange, value }: POSProductSearchProps): JSX.Element {
  return (
    <label className="relative block">
      <span className="sr-only">Search products</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mocha" />
      <Input
        className="h-12 rounded-2xl border-brand-cappuccino bg-white pl-10 text-base shadow-none"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search product, SKU, barcode..."
        value={value}
      />
    </label>
  );
}
