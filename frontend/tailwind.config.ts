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
        panel: "0 16px 48px rgba(59, 42, 34, 0.12)",
        float: "0 24px 60px rgba(59, 42, 34, 0.16)",
      },
      backgroundImage: {
        "grain-warm": "radial-gradient(circle at 1px 1px, rgba(59,42,34,0.06) 1px, transparent 0)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
