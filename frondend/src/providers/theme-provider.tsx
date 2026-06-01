"use client";

import type { JSX, ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { type AppThemeId, appThemeStorageKey, defaultAppTheme } from "@/constants/themes";

type ThemeContextValue = {
  theme: AppThemeId;
  setTheme: (theme: AppThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isAppThemeId(value: string | null): value is AppThemeId {
  return value === "latte" || value === "pistachio";
}

function applyTheme(theme: AppThemeId): void {
  if (theme === defaultAppTheme) {
    document.documentElement.removeAttribute("data-theme");
    return;
  }

  document.documentElement.dataset.theme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [theme, setThemeState] = useState<AppThemeId>(defaultAppTheme);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(appThemeStorageKey);
    const nextTheme = isAppThemeId(storedTheme) ? storedTheme : defaultAppTheme;

    setThemeState(nextTheme);
    applyTheme(nextTheme);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: (nextTheme) => {
        setThemeState(nextTheme);
        applyTheme(nextTheme);
        window.localStorage.setItem(appThemeStorageKey, nextTheme);
      },
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreference(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useThemePreference must be used within ThemeProvider.");
  }

  return context;
}
