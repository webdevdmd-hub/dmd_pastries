import { ScanLine } from "lucide-react";
import type { JSX, RefObject } from "react";

import { Input } from "@/components/ui/input";

type POSBarcodeInputProps = {
  inputRef: RefObject<HTMLInputElement | null>;
  onLookup: (query: string) => void;
};

export function POSBarcodeInput({ inputRef, onLookup }: POSBarcodeInputProps): JSX.Element {
  return (
    <label className="relative block">
      <span className="sr-only">Barcode lookup</span>
      <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-mocha" />
      <Input
        className="h-12 rounded-2xl border-brand-cappuccino bg-white pl-10 text-base shadow-none"
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            const query = event.currentTarget.value.trim();
            if (query) {
              onLookup(query);
              event.currentTarget.value = "";
            }
          }
        }}
        placeholder="Scan barcode or enter code"
        ref={inputRef}
      />
    </label>
  );
}
