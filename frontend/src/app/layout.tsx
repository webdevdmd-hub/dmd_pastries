import "./globals.css";

import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import type { JSX, ReactNode } from "react";

import { AppProviders } from "@/providers/app-providers";

const fontSans = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
});

const fontDisplay = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Pastries POS",
  description: "Premium bakery POS SaaS frontend foundation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): JSX.Element {
  return (
    <html
      className={`${fontSans.variable} ${fontDisplay.variable}`}
      data-scroll-behavior="smooth"
      lang="en"
      suppressHydrationWarning
    >
      <body className="font-sans" suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
