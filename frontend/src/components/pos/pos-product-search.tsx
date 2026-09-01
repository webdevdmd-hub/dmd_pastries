import { Search } from "lucide-react";
import type { JSX } from "react";

import { Input } from "@/components/ui/input";

type POSProductSearchProps = {
  onChange: (value: string) => void;
  value: string;
};

export function POSProductSearch({ onChange, value }: POSProductSearchProps): JSX.Element {
  return (
    <label className="relative block min-w-0">
      <span className="sr-only">Search products</span>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
      <Input
        className="h-10 w-full min-w-0 rounded-md border border-border bg-card pl-10 pr-3 text-sm text-foreground shadow-none placeholder:text-foreground-muted focus-visible:ring-2 focus-visible:ring-ring 2xl:pr-20"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search"
        value={value}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-muted px-2 py-1 font-mono text-[0.62rem] font-bold uppercase text-foreground-muted 2xl:inline-flex">
        CMD + K
      </span>
    </label>
  );
}
