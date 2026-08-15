"use client";

import "./globals.css";

import type { JSX } from "react";
import { useEffect, useState } from "react";

import { attemptChunkReload, isChunkLoadError } from "@/lib/errors/chunk-load";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Catches errors thrown by the root layout itself (where the segment-level
 * `error.tsx` cannot reach). It replaces the whole document, so it must render
 * its own `<html>`/`<body>` and cannot depend on app providers — styling is
 * kept inline so it renders even if the stylesheet chunk is the thing that
 * failed.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps): JSX.Element {
  const [reloading] = useState(() => isChunkLoadError(error) && attemptChunkReload());

  useEffect(() => {
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f4f1ea",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          color: "#2b211c",
          padding: "2.5rem 1rem",
        }}
      >
        {reloading ? (
          <p style={{ fontSize: "0.875rem", opacity: 0.7 }}>Reloading…</p>
        ) : (
          <div style={{ maxWidth: "32rem", textAlign: "center" }}>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0 0 0.5rem" }}>
              Something went wrong
            </h1>
            <p
              style={{ fontSize: "0.875rem", lineHeight: 1.6, opacity: 0.8, margin: "0 0 1.5rem" }}
            >
              The application ran into an unexpected error. Try again, or reload if the problem
              continues.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                onClick={reset}
                style={{
                  cursor: "pointer",
                  borderRadius: "0.75rem",
                  border: "none",
                  backgroundColor: "#b07a4b",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  padding: "0.6rem 1.25rem",
                }}
                type="button"
              >
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  cursor: "pointer",
                  borderRadius: "0.75rem",
                  border: "1px solid #d8cfc2",
                  backgroundColor: "transparent",
                  color: "#2b211c",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  padding: "0.6rem 1.25rem",
                }}
                type="button"
              >
                Reload the page
              </button>
            </div>
          </div>
        )}
      </body>
    </html>
  );
}
