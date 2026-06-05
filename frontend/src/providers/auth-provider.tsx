"use client";

import type { JSX, ReactNode } from "react";
import { createContext, useCallback, useEffect, useMemo, useState } from "react";

import { ROUTES } from "@/constants/routes";
import {
  completePasswordReset,
  getCurrentProfile,
  loginSync,
  logoutSync,
  registerOwner,
  requestPasswordReset,
} from "@/lib/api/auth";
import { switchBranch } from "@/lib/api/business";
import { getErrorMessage } from "@/lib/api/client";
import {
  AppwriteSessionAlreadyExistsError,
  getCurrentAppwriteAccount,
  getCurrentAppwriteSession,
  hasStoredAppwriteSession,
  loginWithAppwrite,
  logoutFromAppwrite,
  sendEmailVerification,
  verifyEmailWithSecret,
} from "@/lib/appwrite/auth";
import { onSessionExpired } from "@/lib/auth/session-events";
import type {
  AuthStatus,
  ForgotPasswordInput,
  LoginInput,
  RegisterOwnerInput,
  RegisterOwnerResult,
  ResetPasswordInput,
} from "@/types/auth";
import type { SafeUserProfile } from "@/types/user";

type AuthContextValue = {
  status: AuthStatus;
  user: SafeUserProfile | null;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<SafeUserProfile>;
  continueCurrentSession: () => Promise<SafeUserProfile>;
  restartLogin: (input: LoginInput) => Promise<SafeUserProfile>;
  refreshProfile: () => Promise<SafeUserProfile>;
  register: (input: RegisterOwnerInput) => Promise<RegisterOwnerResult>;
  logout: () => Promise<void>;
  forgotPassword: (input: ForgotPasswordInput) => Promise<void>;
  resetPassword: (input: ResetPasswordInput) => Promise<void>;
  resendVerification: () => Promise<void>;
  verifyEmail: (userId: string, secret: string) => Promise<void>;
  restoreSession: () => Promise<void>;
};

const verificationRedirectPath = "/verify-email";

export const AuthContext = createContext<AuthContextValue | null>(null);

async function repairAssignedBranchContext(profile: SafeUserProfile): Promise<SafeUserProfile> {
  if (profile.currentBranchId || !profile.assignedBranchId) {
    return profile;
  }

  try {
    const switchedBranch = await switchBranch({ branchId: profile.assignedBranchId });
    const refreshedProfile = await getCurrentProfile();

    return {
      ...refreshedProfile,
      currentBranchId: refreshedProfile.currentBranchId ?? switchedBranch.currentBranchId,
      currentBranchName:
        refreshedProfile.currentBranchName ??
        refreshedProfile.assignedBranchName ??
        profile.assignedBranchName,
    };
  } catch {
    return profile;
  }
}

function buildAbsoluteUrl(path: string): string {
  if (typeof window === "undefined") {
    return path;
  }

  return new URL(path, window.location.origin).toString();
}

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<SafeUserProfile | null>(null);

  const refreshCurrentProfile = useCallback(async (): Promise<SafeUserProfile> => {
    const profile = await repairAssignedBranchContext(await getCurrentProfile());
    setUser(profile);
    setStatus("authenticated");
    return profile;
  }, []);

  const restoreSession = useCallback(async (): Promise<void> => {
    setStatus("loading");

    try {
      if (!hasStoredAppwriteSession()) {
        setUser(null);
        setStatus("unauthenticated");
        return;
      }

      const session = await getCurrentAppwriteSession();

      if (!session) {
        setUser(null);
        setStatus("unauthenticated");
        return;
      }

      const account = await getCurrentAppwriteAccount();

      if (!account) {
        setUser(null);
        setStatus("unauthenticated");
        return;
      }

      await refreshCurrentProfile();
    } catch {
      try {
        await logoutFromAppwrite();
      } catch {
        // Swallow logout cleanup failure and reset local state.
      }

      setUser(null);
      setStatus("unauthenticated");
    }
  }, [refreshCurrentProfile]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    const refreshOnFocus = (): void => {
      if (document.visibilityState === "visible") {
        void refreshCurrentProfile().catch(() => {
          // Keep the current session state if a background profile refresh fails.
        });
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [refreshCurrentProfile, status]);

  useEffect(() => {
    return onSessionExpired(() => {
      void logoutFromAppwrite().finally(() => {
        setUser(null);
        setStatus("unauthenticated");

        if (
          typeof window !== "undefined" &&
          !window.location.pathname.startsWith(ROUTES.login) &&
          !window.location.pathname.startsWith(ROUTES.signup)
        ) {
          window.location.replace(ROUTES.login);
        }
      });
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isAuthenticated: status === "authenticated" && user !== null,
      async login(input) {
        const existingSession = await getCurrentAppwriteSession();

        if (existingSession) {
          throw new AppwriteSessionAlreadyExistsError();
        }

        await loginWithAppwrite(input.email, input.password);
        await loginSync();
        const profile = await refreshCurrentProfile();
        return profile;
      },
      async continueCurrentSession() {
        const account = await getCurrentAppwriteAccount();

        if (!account) {
          throw new Error("No active Appwrite session was found. Please restart login.");
        }

        await loginSync();
        const profile = await refreshCurrentProfile();
        return profile;
      },
      async restartLogin(input) {
        try {
          await logoutFromAppwrite();
        } catch {
          // Continue with a fresh login attempt even if session cleanup is already done.
        }

        await loginWithAppwrite(input.email, input.password);
        await loginSync();
        const profile = await refreshCurrentProfile();
        return profile;
      },
      async refreshProfile() {
        return refreshCurrentProfile();
      },
      async register(input) {
        const registered = await registerOwner(input);

        try {
          await loginWithAppwrite(input.email, input.password);
          await loginSync();
          const profile = await refreshCurrentProfile();

          return {
            ...registered,
            user: profile,
            redirectTo: ROUTES.dashboard,
            message: registered.message,
          };
        } catch {
          setUser(null);
          setStatus("unauthenticated");

          return {
            ...registered,
            user: null,
            redirectTo: ROUTES.login,
            message:
              "Your account was created. Please login to continue setting up your workspace.",
          };
        }
      },
      async logout() {
        try {
          try {
            await logoutSync();
          } catch {
            // Logout must continue even if backend audit sync is unavailable.
          }

          await logoutFromAppwrite();
        } finally {
          setUser(null);
          setStatus("unauthenticated");
        }
      },
      async forgotPassword(input) {
        await requestPasswordReset(input);
      },
      async resetPassword(input) {
        await completePasswordReset(input);
      },
      async resendVerification() {
        await sendEmailVerification(buildAbsoluteUrl(verificationRedirectPath));
      },
      async verifyEmail(userId, secret) {
        await verifyEmailWithSecret(userId, secret);

        try {
          await refreshCurrentProfile();
        } catch (error) {
          setStatus("authenticated");
          throw new Error(getErrorMessage(error));
        }
      },
      restoreSession,
    }),
    [refreshCurrentProfile, restoreSession, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
