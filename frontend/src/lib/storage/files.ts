"use client";

/**
 * The one place the app talks to a file store.
 *
 * Same shape as `lib/auth/session`, for the same reason: the components above
 * this file deal in images and receipts, not in Appwrite buckets or Supabase
 * object paths, so the cutover is an environment variable rather than a change
 * to fourteen call sites.
 *
 * Storage moves separately from auth. They share nothing but the provider name,
 * and doing them together would mean debugging two migrations at once during
 * one window.
 */

import {
  getStorageFilePreviewUrl as getAppwritePreviewUrl,
  uploadStorageFile as uploadToAppwrite,
} from "@/lib/appwrite/storage";
import { getPublicEnvValue } from "@/lib/public-env";
import type { StorageBucketKey } from "@/lib/storage/buckets";
import * as supabaseStorage from "@/lib/supabase/storage";

export type { StorageBucketKey } from "@/lib/storage/buckets";

/**
 * Where a stored file lives, in whichever provider holds it.
 *
 * Both are carried because during the migration both may be true: a file copied
 * to Supabase still has its Appwrite id, and a file uploaded before the copy
 * ran has only the id. Reads prefer the path and fall back, so a file the copy
 * missed still renders instead of 404ing.
 */
export type StoredFile = {
  fileId: string | null;
  storagePath?: string | null;
  /** The plain URL column that predates file ids. Last resort. */
  url?: string | null;
};

function supabaseIsActive(): boolean {
  return (
    getPublicEnvValue("NEXT_PUBLIC_STORAGE_PROVIDER") === "supabase" &&
    supabaseStorage.isConfigured()
  );
}

/**
 * Resolve a stored file to something an <img> can load.
 *
 * The fallback order is deliberate and is what makes the copy non-atomic:
 * a Supabase path if the file has been copied, else the Appwrite id, else the
 * legacy URL column. A file the copy has not reached yet still renders from
 * Appwrite, so the copy can run for hours without a visible gap.
 */
export function getFileUrl(bucket: StorageBucketKey, file: StoredFile): string | null {
  if (supabaseIsActive() && file.storagePath) {
    const url = supabaseStorage.getPublicUrl(bucket, file.storagePath);
    if (url) {
      return url;
    }
  }

  return getAppwritePreviewUrl(bucket, file.fileId) ?? file.url ?? null;
}

/**
 * Upload a file, returning its Appwrite id.
 *
 * Reads and writes move at different times, and the comment inside says why.
 */
export async function uploadFile(bucket: StorageBucketKey, file: File): Promise<string> {
  if (supabaseIsActive()) {
    // Reads can move before writes do, and they should: the copy runs for
    // hours and every read falls back, so nothing breaks while it does. Writes
    // cannot, because persisting a Supabase object path needs an API that
    // accepts one, and every upload path here still writes to a *_file_id
    // column.
    //
    // Failing loudly is the point. Returning the path would put it in a column
    // read as an Appwrite id, and returning "" would write an empty id -- both
    // silent, both only visible later as a broken image nobody can trace back
    // to the day storage was switched over.
    throw new Error(
      "Uploads still go to Appwrite. Supabase storage is read-only until the API " +
        "accepts a storage path; leave NEXT_PUBLIC_STORAGE_PROVIDER unset for uploads.",
    );
  }

  return uploadToAppwrite(bucket, file);
}

/** Which store new uploads go to. */
export function activeStorageProvider(): "appwrite" | "supabase" {
  return supabaseIsActive() ? "supabase" : "appwrite";
}

/**
 * Anything carrying a product image, however it was stored.
 *
 * Callers pass the whole record rather than one field, which is why the
 * storage-path migration does not need a second pass over every call site: when
 * the API starts returning imageStoragePath, these functions start preferring
 * it and nothing above changes.
 */
export type ImageSource = {
  imageFileId?: string | null;
  imageStoragePath?: string | null;
  imageUrl?: string | null;
} | null;

export function getProductImageUrl(source: ImageSource): string | null {
  if (!source) {
    return null;
  }
  return getFileUrl("productImages", {
    fileId: source.imageFileId ?? null,
    storagePath: source.imageStoragePath ?? null,
    url: source.imageUrl ?? null,
  });
}

export type LogoSource = {
  logoFileId?: string | null;
  logoStoragePath?: string | null;
  logoUrl?: string | null;
} | null;

export function getBusinessAssetUrl(source: LogoSource): string | null {
  if (!source) {
    return null;
  }
  return getFileUrl("businessAssets", {
    fileId: source.logoFileId ?? null,
    storagePath: source.logoStoragePath ?? null,
    url: source.logoUrl ?? null,
  });
}

/** Convenience wrappers so call sites name the bucket by intent, not by key. */
export async function uploadProductImage(file: File): Promise<string> {
  return uploadFile("productImages", file);
}

export async function uploadBusinessAsset(file: File): Promise<string> {
  return uploadFile("businessAssets", file);
}
