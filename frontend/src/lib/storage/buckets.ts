/**
 * The buckets this app stores files in, named by role rather than by provider.
 *
 * Kept in its own module so both provider implementations can import it without
 * importing each other: `lib/storage/files` imports both of them, so a type
 * living there would make the graph circular.
 *
 * The names are the app's own. Appwrite resolves each to an opaque bucket id
 * from an environment variable; Supabase maps each to a plain bucket name.
 * Neither mapping leaks past its own module.
 */
export type StorageBucketKey = "businessAssets" | "documents" | "productImages" | "userAvatars";
