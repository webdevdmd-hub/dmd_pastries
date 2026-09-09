"use client";

import { getPublicEnvValue } from "@/lib/public-env";
import type { StorageBucketKey } from "@/lib/storage/buckets";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * The Supabase half of the storage seam.
 *
 * Buckets are named rather than id'd. Appwrite generates an opaque bucket id
 * per bucket, which is why the Appwrite module reads three separate environment
 * variables; Supabase buckets have plain names, so the mapping is a constant
 * and there is nothing to configure per deployment.
 */
const BUCKETS: Record<StorageBucketKey, string | null> = {
  businessAssets: "business-assets",
  documents: "documents",
  productImages: "product-images",
};

export function isConfigured(): boolean {
  return Boolean(
    getPublicEnvValue("NEXT_PUBLIC_SUPABASE_URL") &&
    getPublicEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}

function bucketName(bucket: StorageBucketKey): string | null {
  return BUCKETS[bucket] ?? null;
}

/**
 * The public URL for an object.
 *
 * product-images and business-assets are public-read, which matches how
 * Appwrite serves them today: getFilePreview returns an unauthenticated URL
 * that goes straight into a src attribute. Making those private would mean
 * signed URLs with expiries on every product tile, which is a different
 * feature, not a like-for-like move.
 *
 * documents is private, and deliberately not symmetrical. It holds expense
 * receipts -- financial records -- and nothing in the app renders one: the
 * expense screen prints the file id as text. So a public documents bucket would
 * expose every receipt to anyone holding a URL and buy nothing back. If
 * receipts are ever displayed, that wants a signed URL, which is a change here
 * rather than a change to the bucket.
 *
 * Returns null rather than throwing when unconfigured, so the seam can fall
 * back to Appwrite instead of blanking a product grid.
 */
export function getPublicUrl(bucket: StorageBucketKey, path: string): string | null {
  const client = getSupabaseClient();
  const name = bucketName(bucket);
  if (!client || !name || !path) {
    return null;
  }

  return client.storage.from(name).getPublicUrl(path).data.publicUrl;
}

/**
 * Upload a file and return its object path.
 *
 * The path is generated here rather than reusing the filename: two people
 * uploading "photo.jpg" would otherwise collide, and with upsert off the second
 * upload fails while the first silently stays. A random prefix makes that
 * impossible and keeps the original name visible for anyone browsing the
 * bucket.
 */
export async function upload(bucket: StorageBucketKey, file: File): Promise<string> {
  const client = getSupabaseClient();
  const name = bucketName(bucket);
  if (!client || !name) {
    throw new Error(`Supabase storage is not configured for ${bucket}.`);
  }

  const path = `${crypto.randomUUID()}-${sanitiseFilename(file.name)}`;

  const { error } = await client.storage.from(name).upload(path, file, {
    // Off deliberately. Every path is unique by construction, so an upsert
    // could only ever overwrite somebody else's file after a collision that
    // should not be possible -- better to fail loudly than replace a receipt.
    upsert: false,
    // Only set when the browser gave us one. Passing an empty string would
    // have the object served as an empty content type, which browsers download
    // rather than display -- turning a product photo into a file prompt.
    ...(file.type ? { contentType: file.type } : {}),
  });

  if (error) {
    throw new Error(`Could not upload to ${bucket}: ${error.message}`);
  }
  return path;
}

/**
 * Keep the filename recognisable without letting it shape the path.
 *
 * A slash would create a folder, a leading dot would hide the object, and a
 * long name from a phone camera can push the path past the column width the
 * database allows.
 */
function sanitiseFilename(filename: string): string {
  const cleaned = filename
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^[.-]+/, "")
    .slice(0, 80);

  return cleaned || "file";
}
