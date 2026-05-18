export type PublicEnvKey =
  | "NEXT_PUBLIC_API_BASE_URL"
  | "NEXT_PUBLIC_APPWRITE_BUSINESS_ASSETS_BUCKET_ID"
  | "NEXT_PUBLIC_APPWRITE_DOCUMENTS_BUCKET_ID"
  | "NEXT_PUBLIC_APPWRITE_ENDPOINT"
  | "NEXT_PUBLIC_APPWRITE_PRODUCT_IMAGES_BUCKET_ID"
  | "NEXT_PUBLIC_APPWRITE_PROJECT_ID"
  | "NEXT_PUBLIC_APPWRITE_USER_AVATARS_BUCKET_ID";

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
