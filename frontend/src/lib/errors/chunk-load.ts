/**
 * Chunk-load error handling.
 *
 * Next.js code-splits the app into JS chunks. When a chunk request fails —
 * a flaky dev server dropping the connection, or (in production) a user
 * holding a stale tab after a new deploy has replaced the hashed chunk files —
 * React throws a `ChunkLoadError`. Without recovery the failed chunk leaves the
 * user stranded on a blank screen. A single full reload pulls the current
 * chunk manifest and almost always resolves it.
 */

const RELOAD_GUARD_KEY = "pos:chunk-reload-at";
// If a reload was triggered within this window we assume reloading is not
// helping (chunk genuinely gone, server down) and stop looping so we can show
// the user a real error instead of a reload flicker.
const RELOAD_GUARD_WINDOW_MS = 10_000;

const CHUNK_ERROR_PATTERN =
  /Loading chunk [\w-]+ failed|Failed to load chunk|ChunkLoadError|error loading dynamically imported module|Importing a module script failed/i;

export function isChunkLoadError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  if (typeof error === "object") {
    const named = error as { name?: unknown; message?: unknown };
    if (named.name === "ChunkLoadError") {
      return true;
    }
    if (typeof named.message === "string" && CHUNK_ERROR_PATTERN.test(named.message)) {
      return true;
    }
  }

  if (typeof error === "string") {
    return CHUNK_ERROR_PATTERN.test(error);
  }

  return false;
}

/**
 * Reloads the page once to recover from a chunk-load failure, guarding against
 * an infinite reload loop when the reload does not help.
 *
 * @returns `true` if a reload was triggered (caller should render a neutral
 *   placeholder while it happens), `false` if we recently reloaded already and
 *   the caller should surface a normal error UI instead.
 */
export function attemptChunkReload(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_GUARD_KEY) ?? "0");
    if (Number.isFinite(last) && Date.now() - last < RELOAD_GUARD_WINDOW_MS) {
      // Already reloaded very recently — reloading again would just loop.
      return false;
    }
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    // sessionStorage can be unavailable (privacy mode). Fall back to reloading
    // without the guard rather than leaving the user on a blank screen.
  }

  window.location.reload();
  return true;
}
