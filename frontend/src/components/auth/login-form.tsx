"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import { AppwriteRateLimitError, AppwriteSessionAlreadyExistsError } from "@/lib/appwrite/auth";
import { authenticatedHomeRoute } from "@/lib/auth/routes";
import { type LoginSchema, loginSchema } from "@/validators/auth.schema";

export function LoginForm(): JSX.Element {
  const router = useRouter();
  const { continueCurrentSession, login, restartLogin } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sessionConflict, setSessionConflict] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [rateLimitUntil, setRateLimitUntil] = useState(0);
  const [cooldownNow, setCooldownNow] = useState(() => Date.now());
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
  const cooldownRemainingMs = Math.max(0, rateLimitUntil - cooldownNow);
  const cooldownRemainingSeconds = Math.ceil(cooldownRemainingMs / 1000);
  const isCooldownActive = cooldownRemainingSeconds > 0;

  useEffect(() => {
    if (!rateLimited || !isCooldownActive) {
      return;
    }

    const interval = window.setInterval(() => {
      setCooldownNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isCooldownActive, rateLimited]);

  function applyRateLimit(error: AppwriteRateLimitError): void {
    setRateLimited(true);
    setSubmitError(error.message);
    setCooldownNow(Date.now());
    setRateLimitUntil(Date.now() + error.retryAfterMs);
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    setSessionConflict(false);
    setRateLimited(false);

    try {
      const profile = await login(values);
      toast.success("Welcome back. Redirecting to your workspace.");
      router.replace(authenticatedHomeRoute(profile));
    } catch (error) {
      if (error instanceof AppwriteSessionAlreadyExistsError) {
        setSessionConflict(true);
        return;
      }

      if (error instanceof AppwriteRateLimitError) {
        applyRateLimit(error);
        return;
      }

      if (error instanceof ApiError && error.errors) {
        Object.entries(error.errors).forEach(([field, messages]) => {
          const firstMessage = messages[0];

          if ((field === "email" || field === "password") && firstMessage) {
            form.setError(field, { message: firstMessage });
          }
        });
      }

      setSubmitError(getErrorMessage(error));
    }
  });

  const continueSession = async (): Promise<void> => {
    setSubmitError(null);
    setRecoveryLoading(true);

    try {
      const profile = await continueCurrentSession();
      toast.success("Session restored. Redirecting to your workspace.");
      router.replace(authenticatedHomeRoute(profile));
    } catch (error) {
      if (error instanceof AppwriteRateLimitError) {
        applyRateLimit(error);
      } else {
        setSubmitError(getErrorMessage(error));
      }
    } finally {
      setRecoveryLoading(false);
    }
  };

  const restartSessionLogin = async (): Promise<void> => {
    setSubmitError(null);

    const values = form.getValues();
    const parsed = loginSchema.safeParse(values);

    if (!parsed.success) {
      await form.trigger();
      return;
    }

    try {
      setRecoveryLoading(true);
      const profile = await restartLogin(parsed.data);
      setSessionConflict(false);
      setRateLimited(false);
      toast.success("Welcome back. Redirecting to your workspace.");
      router.replace(authenticatedHomeRoute(profile));
    } catch (error) {
      if (error instanceof AppwriteRateLimitError) {
        applyRateLimit(error);
      } else {
        setSubmitError(getErrorMessage(error));
      }
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardContent className="p-0">
        <Form {...form}>
          <form
            className="space-y-6"
            onSubmit={(event) => {
              void onSubmit(event);
            }}
          >
            {submitError && !rateLimited ? (
              <Alert
                className="border-danger/30 bg-danger-tint text-danger-text"
                variant="destructive"
              >
                <AlertTitle>Unable to sign in</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            ) : null}

            {sessionConflict ? (
              <Alert className="border-warning/30 bg-warning-tint text-warning-text">
                <AlertTitle>Session already active</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>
                    You are already signed in on this browser. Continue with that session or restart
                    login with the credentials below.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      disabled={recoveryLoading || isCooldownActive}
                      onClick={() => {
                        void continueSession();
                      }}
                      type="button"
                      className="bg-primary text-primary-foreground hover:bg-primary"
                    >
                      Continue with current session
                    </Button>
                    <Button
                      disabled={recoveryLoading || isCooldownActive}
                      onClick={() => {
                        void restartSessionLogin();
                      }}
                      type="button"
                      className="border-border bg-card text-foreground hover:bg-muted"
                      variant="outline"
                    >
                      Restart login
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}

            {rateLimited ? (
              <Alert className="border-warning/30 bg-warning-tint text-warning-text">
                <AlertTitle>Too many attempts</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>
                    Sign-in is paused on this browser for a moment. Wait{" "}
                    {cooldownRemainingSeconds > 0
                      ? `${String(cooldownRemainingSeconds)} seconds`
                      : "60 seconds"}
                    , then continue with your existing session rather than signing in again.
                  </p>
                  {submitError ? <p className="text-sm text-warning-text">{submitError}</p> : null}
                  <Button
                    disabled={recoveryLoading || isCooldownActive}
                    onClick={() => {
                      void continueSession();
                    }}
                    type="button"
                    className="border-warning/30 bg-card text-warning-text hover:bg-warning-tint"
                    variant="outline"
                  >
                    {isCooldownActive
                      ? `Wait ${String(cooldownRemainingSeconds)}s`
                      : "Continue existing session"}
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">Email</FormLabel>
                  <FormControl>
                    <div className="relative group">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
                      <Input
                        autoComplete="email"
                        className="h-12 rounded-lg border-border bg-card pl-11 text-foreground shadow-none transition placeholder:text-foreground-disabled focus-visible:border-ring focus-visible:ring-ring/40"
                        placeholder="owner@bakery.com"
                        type="email"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-3">
                    <FormLabel className="text-sm font-medium text-foreground">Password</FormLabel>
                    <Link
                      className="text-sm text-foreground-muted underline-offset-4 hover:text-foreground hover:underline"
                      href={ROUTES.forgotPassword}
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <FormControl>
                    <div className="relative group">
                      <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" />
                      <Input
                        autoComplete="current-password"
                        className="h-12 rounded-lg border-border bg-card pl-11 pr-11 text-foreground shadow-none transition placeholder:text-foreground-disabled focus-visible:border-ring focus-visible:ring-ring/40"
                        placeholder="Enter your password"
                        type={showPassword ? "text" : "password"}
                        {...field}
                      />
                      <button
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword}
                        className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-foreground-muted transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                        onClick={() => {
                          setShowPassword((current) => !current);
                        }}
                        title={showPassword ? "Hide password" : "Show password"}
                        type="button"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              className="h-12 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-none transition hover:bg-primary"
              disabled={form.formState.isSubmitting || recoveryLoading || isCooldownActive}
              type="submit"
            >
              {form.formState.isSubmitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Signing in
                </>
              ) : (
                <>
                  Login
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <p className="text-center text-sm text-foreground-muted">
              Need an owner account?{" "}
              <Link
                className="font-medium text-foreground underline-offset-4 hover:underline"
                href={ROUTES.signup}
              >
                Create one now
              </Link>
            </p>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
