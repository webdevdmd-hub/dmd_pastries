"use client";

import { ID } from "appwrite";

import { appwriteStorage } from "@/lib/appwrite/client";

type StorageBucketKey = "businessAssets" | "documents" | "productImages" | "userAvatars";

type AppwriteErrorLike = {
  code?: unknown;
  message?: unknown;
  type?: unknown;
};

const storageBuckets: Record<StorageBucketKey, string | undefined> = {
  productImages: process.env.NEXT_PUBLIC_APPWRITE_PRODUCT_IMAGES_BUCKET_ID,
  businessAssets: process.env.NEXT_PUBLIC_APPWRITE_BUSINESS_ASSETS_BUCKET_ID,
  userAvatars: process.env.NEXT_PUBLIC_APPWRITE_USER_AVATARS_BUCKET_ID,
  documents: process.env.NEXT_PUBLIC_APPWRITE_DOCUMENTS_BUCKET_ID,
};

const storageBucketEnvNames: Record<StorageBucketKey, string> = {
  productImages: "NEXT_PUBLIC_APPWRITE_PRODUCT_IMAGES_BUCKET_ID",
  businessAssets: "NEXT_PUBLIC_APPWRITE_BUSINESS_ASSETS_BUCKET_ID",
  userAvatars: "NEXT_PUBLIC_APPWRITE_USER_AVATARS_BUCKET_ID",
  documents: "NEXT_PUBLIC_APPWRITE_DOCUMENTS_BUCKET_ID",
};

function requireStorage() {
  if (!appwriteStorage) {
    throw new Error("Appwrite environment variables are missing.");
  }

  return appwriteStorage;
}

function requireBucket(bucketKey: StorageBucketKey): string {
  const bucketId = storageBuckets[bucketKey];

  if (!bucketId) {
    throw new Error(`${storageBucketEnvNames[bucketKey]} is missing.`);
  }

  return bucketId;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toAppwriteErrorLike(error: unknown): AppwriteErrorLike | null {
  return isObject(error) ? error : null;
}

function getStorageUploadErrorMessage(bucketKey: StorageBucketKey, error: unknown): string {
  const appwriteError = toAppwriteErrorLike(error);
  const code = typeof appwriteError?.code === "number" ? appwriteError.code : null;
  const message = typeof appwriteError?.message === "string" ? appwriteError.message : "";

  if (code === 401 || code === 403 || message.toLowerCase().includes("not authorized")) {
    return `${storageBucketEnvNames[bucketKey]} is configured, but Appwrite Storage is rejecting uploads. Allow authenticated users to create files in this bucket.`;
  }

  return message || "Unable to upload file to Appwrite Storage.";
}

export async function uploadStorageFile(bucketKey: StorageBucketKey, file: File): Promise<string> {
  try {
    const uploadedFile = await requireStorage().createFile(
      requireBucket(bucketKey),
      ID.unique(),
      file,
    );

    return uploadedFile.$id;
  } catch (error) {
    throw new Error(getStorageUploadErrorMessage(bucketKey, error));
  }
}

export function getStorageFilePreviewUrl(
  bucketKey: StorageBucketKey,
  fileId: string | null,
): string | null {
  const bucketId = storageBuckets[bucketKey];

  if (!fileId || !appwriteStorage || !bucketId) {
    return null;
  }

  return appwriteStorage.getFilePreview(bucketId, fileId);
}

export async function uploadProductImage(file: File): Promise<string> {
  return uploadStorageFile("productImages", file);
}

export function getProductImagePreviewUrl(fileId: string | null): string | null {
  return getStorageFilePreviewUrl("productImages", fileId);
}

export async function uploadBusinessAsset(file: File): Promise<string> {
  return uploadStorageFile("businessAssets", file);
}

export function getBusinessAssetPreviewUrl(fileId: string | null): string | null {
  return getStorageFilePreviewUrl("businessAssets", fileId);
}
