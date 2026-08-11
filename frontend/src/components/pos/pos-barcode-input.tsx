import { ScanLine } from "lucide-react";
import type { JSX, RefObject } from "react";

import { Input } from "@/components/ui/input";

type POSBarcodeInputProps = {
  inputRef: RefObject<HTMLInputElement | null>;
  onLookup: (query: string) => void;
};

export function POSBarcodeInput({ inputRef, onLookup }: POSBarcodeInputProps): JSX.Element {
  return (
    <label className="relative block min-w-0">
      <span className="sr-only">Barcode lookup</span>
      <ScanLine className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      <Input
        className="h-10 w-full min-w-0 rounded-md border-zinc-300 bg-white pl-10 pr-3 text-sm text-zinc-900 shadow-none placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-black"
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            const query = event.currentTarget.value.trim();
            if (query) {
              onLookup(query);
              event.currentTarget.value = "";
            }
          }
        }}
        placeholder="Barcode"
        ref={inputRef}
      />
    </label>
  );
}
