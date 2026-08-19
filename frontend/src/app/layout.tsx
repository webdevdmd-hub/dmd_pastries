import "./globals.css";

import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import type { JSX, ReactNode } from "react";

import { TABLE_DENSITY_BOOT_SCRIPT } from "@/components/density/table-density";
import { AppProviders } from "@/providers/app-providers";

const fontSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

/**
 * Fixes a live bug rather than adding a nicety: 31 files call `font-mono` for
 * money and no mono font was ever loaded, so prices rendered in whatever
 * monospace the OS handed back. A Windows counter terminal and a Mac showed
 * different digits for the same price.
 */
const fontMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

/**
 * Threshold register: the login/landing wordmark. Replaces Cormorant Garamond.
 *
 * Loaded globally for now because 21 of the 24 call sites this replaced are
 * dashboard components (settings, purchasing, customers, recipes).
 * Per DESIGN.md section 2 a display serif does not belong on those screens at
 * all — they should be `text-title`/`text-page` in Geist. Demoting them is a
 * typography decision across 21 files, which belongs in track B4, not in this
 * commit. Once B4 lands, scope this to the threshold layouts with
 * `preload: false` so /pos stops preloading a serif it never renders.
 */
const fontSerif = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Pastries POS",
  description: "Production-based POS and ERP for bakery operations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): JSX.Element {
  return (
    <html
      className={`${fontSans.variable} ${fontMono.variable} ${fontSerif.variable}`}
      lang="en"
      suppressHydrationWarning
    >
      <body className="font-sans" suppressHydrationWarning>
        {/* Stamps the stored table density onto <html> before the first paint.
            useTableDensity can only do it in an effect, which runs after paint,
            so a hard load rendered every table at `default` and then jumped to
            the stored row height. It also only ran on routes that mount the
            toggle, while the attribute and the preference are both global.

            This has to be a raw inline <script> rather than a component: the
            dashboard layout is auth-gated and server-renders its loading
            fallback, so nothing in that subtree reaches the initial HTML, and
            an effect anywhere is by definition too late. <html> already carries
            suppressHydrationWarning for exactly this kind of pre-hydration
            attribute. Failure is silent and harmless -- an unreadable or
            invalid value leaves the attribute off, which globals.css already
            treats as `default`. */}
        <script dangerouslySetInnerHTML={{ __html: TABLE_DENSITY_BOOT_SCRIPT }} />
        <Script src="/env-config.js" strategy="beforeInteractive" />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
