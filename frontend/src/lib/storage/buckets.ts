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
/**
 * userAvatars was removed on 2026-09-09. Nothing ever uploaded to it and
 * nothing ever rendered from it: the user screens use Avatar with
 * AvatarFallback and no AvatarImage, so every avatar in the app is initials.
 * Carrying it into Supabase would have meant creating a bucket, copying
 * nothing into it, and verifying it on every migration afterwards.
 *
 * users.avatar_file_id and the API fields around it are deliberately kept.
 * This removes a bucket, not the ability to store an avatar -- if staff
 * avatars are ever built, the column is still there and the bucket is one
 * line to add back.
 */
export type StorageBucketKey = "businessAssets" | "documents" | "productImages";
