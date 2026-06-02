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
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717a]" />
      <Input
        className="h-12 rounded-lg border-0 bg-[#f0f0f1] pl-11 pr-20 text-base text-[#18181b] shadow-none placeholder:text-[#71717a] focus-visible:ring-2 focus-visible:ring-black"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Product name, SKU, or scan barcode..."
        value={value}
      />
      <span className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded border border-[#d4d4d8] bg-white px-2 py-1 font-mono text-[0.62rem] font-bold uppercase text-[#71717a] md:inline-flex">
        CMD + K
      </span>
    </label>
  );
}
