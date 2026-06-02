export type AppThemeId = "latte" | "pistachio";

export type AppTheme = {
  id: AppThemeId;
  label: string;
  description: string;
  swatches: string[];
};

export const appThemes = [
  {
    id: "latte",
    label: "Operations Neutral",
    description: "Clean POS-inspired neutrals for operational workspaces.",
    swatches: ["#FAFAF9", "#F5F4F1", "#D4D0C9", "#52525B", "#09090B"],
  },
  {
    id: "pistachio",
    label: "Pistachio Fresh",
    description: "White-first mint surfaces with fresh green accents.",
    swatches: ["#FFFFFF", "#F7FFF9", "#EAF8EF", "#DFF5E7", "#43B66B"],
  },
] satisfies AppTheme[];

export const defaultAppTheme: AppThemeId = "latte";
export const appThemeStorageKey = "pastries-pos-theme";
