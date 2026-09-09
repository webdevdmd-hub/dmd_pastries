import { NextResponse } from "next/server";

import type { PublicEnvKey } from "@/lib/public-env";

// The key list is imported rather than restated. It used to be a second union
// declared here, and the two drifted: NEXT_PUBLIC_SUPABASE_URL,
// NEXT_PUBLIC_SUPABASE_ANON_KEY and both provider flags were added to the one
// in lib/public-env and never to this one, so getPublicEnvValue returned
// undefined for all four in the browser and the entire Supabase frontend was
// unreachable no matter what was set in the environment. Nothing errored --
// the seams simply read "not configured" and stayed on Appwrite.

const publicEnvKeys: PublicEnvKey[] = [
  "NEXT_PUBLIC_API_BASE_URL",
  "NEXT_PUBLIC_APPWRITE_ENDPOINT",
  "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
  "NEXT_PUBLIC_APPWRITE_PRODUCT_IMAGES_BUCKET_ID",
  "NEXT_PUBLIC_APPWRITE_BUSINESS_ASSETS_BUCKET_ID",
  "NEXT_PUBLIC_APPWRITE_DOCUMENTS_BUCKET_ID",
  "NEXT_PUBLIC_AUTH_PROVIDER",
  "NEXT_PUBLIC_STORAGE_PROVIDER",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

export const dynamic = "force-dynamic";

function getPublicEnvScript(): string {
  const values = publicEnvKeys.reduce<Record<PublicEnvKey, string>>(
    (environment, key) => ({
      ...environment,
      [key]: process.env[key] ?? "",
    }),
    {
      NEXT_PUBLIC_API_BASE_URL: "",
      NEXT_PUBLIC_APPWRITE_BUSINESS_ASSETS_BUCKET_ID: "",
      NEXT_PUBLIC_APPWRITE_DOCUMENTS_BUCKET_ID: "",
      NEXT_PUBLIC_APPWRITE_ENDPOINT: "",
      NEXT_PUBLIC_APPWRITE_PRODUCT_IMAGES_BUCKET_ID: "",
      NEXT_PUBLIC_APPWRITE_PROJECT_ID: "",
      NEXT_PUBLIC_AUTH_PROVIDER: "",
      NEXT_PUBLIC_STORAGE_PROVIDER: "",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      // Present to satisfy the exhaustive key type, and deliberately absent
      // from publicEnvKeys above: the E2E bypass must not be servable from a
      // production environment variable. An empty runtime value falls through
      // to the build-time map, so an actual E2E build is unaffected.
      NEXT_PUBLIC_E2E_AUTH_ENABLED: "",
      NEXT_PUBLIC_E2E_AUTH_TOKEN: "",
    },
  );

  return `window.__PUBLIC_ENV__ = ${JSON.stringify(values)};`;
}

export function GET(): NextResponse {
  return new NextResponse(getPublicEnvScript(), {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Content-Type": "application/javascript; charset=utf-8",
    },
  });
}
