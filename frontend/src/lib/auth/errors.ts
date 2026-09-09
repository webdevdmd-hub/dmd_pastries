/**
 * Authentication failures the UI reacts to, named after what happened rather
 * than after whoever reported it.
 *
 * These live apart from any provider on purpose. Both Appwrite and Supabase
 * throw them, so the components that catch them keep working across the
 * migration — and `instanceof` keeps working, which it would not if each
 * provider defined its own class.
 */

/**
 * A different account is already signed in on this browser.
 *
 * Recoverable, and the UI offers a choice rather than an error: continue as the
 * signed-in user, or sign them out and start again. Losing that distinction
 * would turn a two-button prompt into a dead end on a shared terminal.
 */
export class SessionAlreadyExistsError extends Error {
  constructor(message = "Another account is already signed in on this browser.") {
    super(message);
    this.name = "SessionAlreadyExistsError";
  }
}

/**
 * The provider is refusing sign-in attempts for a while.
 *
 * `retryAfterMs` is carried because the honest answer is provider-specific:
 * Appwrite counts in fixed hourly buckets, so the wait runs to the top of the
 * hour and a flat "try again in 60 seconds" is a lie the user can catch you in.
 */
export class AuthRateLimitError extends Error {
  readonly retryAfterMs: number;

  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = "AuthRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}
