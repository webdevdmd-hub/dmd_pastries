import { NextResponse } from "next/server";

type PublicEnvKey =
  | "NEXT_PUBLIC_API_BASE_URL"
  | "NEXT_PUBLIC_APPWRITE_BUSINESS_ASSETS_BUCKET_ID"
  | "NEXT_PUBLIC_APPWRITE_DOCUMENTS_BUCKET_ID"
  | "NEXT_PUBLIC_APPWRITE_ENDPOINT"
  | "NEXT_PUBLIC_APPWRITE_PRODUCT_IMAGES_BUCKET_ID"
  | "NEXT_PUBLIC_APPWRITE_PROJECT_ID"
  | "NEXT_PUBLIC_APPWRITE_USER_AVATARS_BUCKET_ID";

const publicEnvKeys: PublicEnvKey[] = [
  "NEXT_PUBLIC_API_BASE_URL",
  "NEXT_PUBLIC_APPWRITE_ENDPOINT",
  "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
  "NEXT_PUBLIC_APPWRITE_PRODUCT_IMAGES_BUCKET_ID",
  "NEXT_PUBLIC_APPWRITE_BUSINESS_ASSETS_BUCKET_ID",
  "NEXT_PUBLIC_APPWRITE_USER_AVATARS_BUCKET_ID",
  "NEXT_PUBLIC_APPWRITE_DOCUMENTS_BUCKET_ID",
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
      NEXT_PUBLIC_APPWRITE_USER_AVATARS_BUCKET_ID: "",
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
