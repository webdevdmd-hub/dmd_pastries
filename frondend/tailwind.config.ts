import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          latte: "rgb(var(--brand-latte) / <alpha-value>)",
          cappuccino: "rgb(var(--brand-cappuccino) / <alpha-value>)",
          caramel: "rgb(var(--brand-caramel) / <alpha-value>)",
          mocha: "rgb(var(--brand-mocha) / <alpha-value>)",
          espresso: "rgb(var(--brand-espresso) / <alpha-value>)",
        },
        workspace: {
          canvas: "rgb(var(--workspace-canvas) / <alpha-value>)",
          sidebar: "rgb(var(--workspace-sidebar) / <alpha-value>)",
          "sidebar-panel": "rgb(var(--workspace-sidebar-panel) / <alpha-value>)",
          "sidebar-active": "rgb(var(--workspace-sidebar-active) / <alpha-value>)",
          "sidebar-muted": "rgb(var(--workspace-sidebar-muted) / <alpha-value>)",
          panel: "rgb(var(--workspace-panel) / <alpha-value>)",
          border: "rgb(var(--workspace-border) / <alpha-value>)",
          muted: "rgb(var(--workspace-muted) / <alpha-value>)",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        panel: "0 10px 30px rgba(59, 42, 34, 0.08)",
        float: "0 22px 54px rgba(59, 42, 34, 0.14)",
        workspace: "0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 55px rgba(13, 17, 23, 0.22)",
      },
      backgroundImage: {
        "grain-warm": "radial-gradient(circle at 1px 1px, rgba(59,42,34,0.06) 1px, transparent 0)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
