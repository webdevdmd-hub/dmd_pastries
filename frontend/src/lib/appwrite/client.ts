"use client";

import { Account, Client, Storage } from "appwrite";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

const appwriteClient =
  endpoint && projectId ? new Client().setEndpoint(endpoint).setProject(projectId) : null;

export const appwriteAccount = appwriteClient ? new Account(appwriteClient) : null;
export const appwriteStorage = appwriteClient ? new Storage(appwriteClient) : null;

export function isAppwriteConfigured(): boolean {
  return appwriteAccount !== null;
}

export function getAppwriteProjectId(): string | null {
  return projectId ?? null;
}
