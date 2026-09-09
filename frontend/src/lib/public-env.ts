export type PublicEnvKey =
  | "NEXT_PUBLIC_API_BASE_URL"
  | "NEXT_PUBLIC_APPWRITE_BUSINESS_ASSETS_BUCKET_ID"
  | "NEXT_PUBLIC_APPWRITE_DOCUMENTS_BUCKET_ID"
  | "NEXT_PUBLIC_APPWRITE_ENDPOINT"
  | "NEXT_PUBLIC_APPWRITE_PRODUCT_IMAGES_BUCKET_ID"
  | "NEXT_PUBLIC_APPWRITE_PROJECT_ID"
  | "NEXT_PUBLIC_APPWRITE_USER_AVATARS_BUCKET_ID"
  // Which identity provider issues sessions in this build. Mirrors the
  // backend's AUTH_PRIMARY_PROVIDER: the backend verifies both throughout the
  // migration, so the cutover is these two variables flipping together, and the
  // rollback is flipping them back.
  | "NEXT_PUBLIC_AUTH_PROVIDER"
  // Storage moves separately from auth: they share nothing but a provider
  // name, and one window debugging two migrations is one too many.
  | "NEXT_PUBLIC_STORAGE_PROVIDER"
  | "NEXT_PUBLIC_SUPABASE_URL"
  // Public by design -- it is the key the browser is meant to hold, and it
  // grants only what RLS and the exposed schemas allow. It is not the
  // service_role key, which must never reach a bundle.
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "NEXT_PUBLIC_E2E_AUTH_ENABLED"
  | "NEXT_PUBLIC_E2E_AUTH_TOKEN";

type RuntimePublicEnv = Partial<Record<PublicEnvKey, string>>;

type RuntimeWindow = Window & {
  __PUBLIC_ENV__?: RuntimePublicEnv;
};

function createPublicEnv(values: [PublicEnvKey, string | undefined][]): RuntimePublicEnv {
  return values.reduce<RuntimePublicEnv>((environment, [key, value]) => {
    if (value && value.length > 0) {
      environment[key] = value;
    }

    return environment;
  }, {});
}

const buildTimePublicEnv = createPublicEnv([
  ["NEXT_PUBLIC_API_BASE_URL", process.env.NEXT_PUBLIC_API_BASE_URL],
  ["NEXT_PUBLIC_APPWRITE_ENDPOINT", process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT],
  ["NEXT_PUBLIC_APPWRITE_PROJECT_ID", process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID],
  [
    "NEXT_PUBLIC_APPWRITE_PRODUCT_IMAGES_BUCKET_ID",
    process.env.NEXT_PUBLIC_APPWRITE_PRODUCT_IMAGES_BUCKET_ID,
  ],
  [
    "NEXT_PUBLIC_APPWRITE_BUSINESS_ASSETS_BUCKET_ID",
    process.env.NEXT_PUBLIC_APPWRITE_BUSINESS_ASSETS_BUCKET_ID,
  ],
  [
    "NEXT_PUBLIC_APPWRITE_USER_AVATARS_BUCKET_ID",
    process.env.NEXT_PUBLIC_APPWRITE_USER_AVATARS_BUCKET_ID,
  ],
  [
    "NEXT_PUBLIC_APPWRITE_DOCUMENTS_BUCKET_ID",
    process.env.NEXT_PUBLIC_APPWRITE_DOCUMENTS_BUCKET_ID,
  ],
  ["NEXT_PUBLIC_E2E_AUTH_ENABLED", process.env.NEXT_PUBLIC_E2E_AUTH_ENABLED],
  ["NEXT_PUBLIC_E2E_AUTH_TOKEN", process.env.NEXT_PUBLIC_E2E_AUTH_TOKEN],
]);

function getRuntimePublicEnv(): RuntimePublicEnv {
  if (typeof window === "undefined") {
    return {};
  }

  return (window as RuntimeWindow).__PUBLIC_ENV__ ?? {};
}

export function getPublicEnvValue(key: PublicEnvKey): string | undefined {
  const runtimeValue = getRuntimePublicEnv()[key];

  if (runtimeValue && runtimeValue.length > 0) {
    return runtimeValue;
  }

  return buildTimePublicEnv[key];
}
