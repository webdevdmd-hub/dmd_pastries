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
      <ScanLine className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717a]" />
      <Input
        className="h-10 rounded-md border-[#d4d4d8] bg-white pl-10 text-sm text-[#18181b] shadow-none placeholder:text-[#71717a] focus-visible:ring-2 focus-visible:ring-black"
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            const query = event.currentTarget.value.trim();
            if (query) {
              onLookup(query);
              event.currentTarget.value = "";
            }
          }
        }}
        placeholder="Scan barcode"
        ref={inputRef}
      />
    </label>
  );
}
