"use client";

import { Palette } from "lucide-react";
import type { JSX } from "react";

import {
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { appThemes } from "@/constants/themes";
import { useThemePreference } from "@/providers/theme-provider";

export function ThemeSelector(): JSX.Element {
  const { setTheme, theme } = useThemePreference();

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Palette className="mr-2 h-4 w-4" />
        Theme
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-64">
        {appThemes.map((item) => (
          <button
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm text-brand-espresso outline-none transition hover:bg-brand-cappuccino/40 focus:bg-brand-cappuccino/40"
            key={item.id}
            onClick={() => setTheme(item.id)}
            type="button"
          >
            <span className="flex h-8 w-14 overflow-hidden rounded-full border border-brand-cappuccino">
              {item.swatches.slice(1).map((swatch) => (
                <span className="flex-1" key={swatch} style={{ backgroundColor: swatch }} />
              ))}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{item.label}</span>
              <span className="block truncate text-xs text-brand-mocha">{item.description}</span>
            </span>
            {theme === item.id ? (
              <span className="text-xs font-bold text-brand-mocha">On</span>
            ) : null}
          </button>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
