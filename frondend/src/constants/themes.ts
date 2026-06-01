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
    label: "Latte",
    description: "Warm bakery browns and creamy surfaces.",
    swatches: ["#F3E9D7", "#D6BFA6", "#B08968", "#7A553A", "#3B2A22"],
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
