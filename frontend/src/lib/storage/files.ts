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
import { compressImage } from "@/lib/storage/compress-image";
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
 * Where a freshly uploaded file went.
 *
 * Both fields exist so the caller never has to ask which provider is live. It
 * writes whichever it was given to the matching column, and the one that is
 * null stays null -- which is exactly what the read fallback expects.
 *
 * Returning a bare string would have forced every form to branch on the
 * provider, putting back the knowledge this module exists to hold.
 */
export type UploadedFile = {
  fileId: string | null;
  storagePath: string | null;
};

/**
 * Upload a file to whichever store is live.
 *
 * A new upload lands in one provider, not both. There is no dual-write here and
 * there should not be: unlike an identity, a file that exists in only one place
 * still renders, because the row carries both addresses and the read prefers
 * whichever is populated.
 *
 * The rollback cost is worth stating plainly. Images uploaded while Supabase is
 * live have a path and no Appwrite id, so switching the provider back makes
 * them fall through to whatever the row held before -- the old image, or none.
 * Everything uploaded before the cutover is unaffected, because the copy gave
 * those rows both addresses.
 */
export async function uploadFile(bucket: StorageBucketKey, file: File): Promise<UploadedFile> {
  // Photos are shrunk before they leave the browser. Receipts are not: the
  // documents bucket holds PDFs and scans that must stay byte-for-byte what
  // was handed in, and a compressed receipt is not a receipt.
  const upload = bucket === "documents" ? file : await compressImage(file);

  if (supabaseIsActive()) {
    return { fileId: null, storagePath: await supabaseStorage.upload(bucket, upload) };
  }

  return { fileId: await uploadToAppwrite(bucket, upload), storagePath: null };
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
export async function uploadProductImage(file: File): Promise<UploadedFile> {
  return uploadFile("productImages", file);
}

export async function uploadBusinessAsset(file: File): Promise<UploadedFile> {
  return uploadFile("businessAssets", file);
}
