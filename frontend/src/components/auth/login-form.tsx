"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useState } from "react";
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
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const form = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

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
        setRateLimited(true);
        setSubmitError(error.message);
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
        setRateLimited(true);
      }

      setSubmitError(getErrorMessage(error));
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
        setRateLimited(true);
      }

      setSubmitError(getErrorMessage(error));
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardContent className="p-0">
        <Form {...form}>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              void onSubmit(event);
            }}
          >
            {submitError && !rateLimited ? (
              <Alert className="border-red-300/30 bg-red-500/10 text-red-100" variant="destructive">
                <AlertTitle>Unable to sign in</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            ) : null}

            {sessionConflict ? (
              <Alert className="border-brand-caramel/30 bg-brand-caramel/10 text-brand-latte">
                <AlertTitle>Session already active</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>
                    Appwrite already has an active session in this browser. Continue with that
                    session or restart login with the credentials below.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      disabled={recoveryLoading}
                      onClick={() => {
                        void continueSession();
                      }}
                      type="button"
                      className="bg-brand-latte text-brand-espresso hover:bg-white"
                    >
                      Continue with current session
                    </Button>
                    <Button
                      disabled={recoveryLoading}
                      onClick={() => {
                        void restartSessionLogin();
                      }}
                      type="button"
                      className="border-white/15 bg-white/5 text-brand-latte hover:bg-white/10"
                      variant="outline"
                    >
                      Restart login
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}

            {rateLimited ? (
              <Alert className="border-brand-caramel/30 bg-brand-caramel/10 text-brand-latte">
                <AlertTitle>Too many login sync attempts</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>
                    Appwrite is temporarily blocking JWT/session requests for this browser. Wait a
                    moment, then continue the existing session instead of creating another login
                    attempt.
                  </p>
                  {submitError ? (
                    <p className="text-sm text-brand-cappuccino">{submitError}</p>
                  ) : null}
                  <Button
                    disabled={recoveryLoading}
                    onClick={() => {
                      void continueSession();
                    }}
                    type="button"
                    className="border-white/15 bg-white/5 text-brand-latte hover:bg-white/10"
                    variant="outline"
                  >
                    Continue existing session
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-brand-latte/88">Email</FormLabel>
                  <FormControl>
                    <div className="relative group">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-cappuccino" />
                      <Input
                        autoComplete="email"
                        className="h-13 rounded-2xl border-white/10 bg-white/[0.07] pl-11 text-brand-latte shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition placeholder:text-brand-cappuccino/62 focus-visible:border-brand-caramel/60 focus-visible:ring-brand-caramel"
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
                    <FormLabel className="text-sm font-medium text-brand-latte/88">
                      Password
                    </FormLabel>
                    <Link
                      className="text-sm text-brand-cappuccino hover:text-brand-latte"
                      href={ROUTES.forgotPassword}
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <FormControl>
                    <div className="relative group">
                      <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-cappuccino" />
                      <Input
                        autoComplete="current-password"
                        className="h-13 rounded-2xl border-white/10 bg-white/[0.07] pl-11 text-brand-latte shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition placeholder:text-brand-cappuccino/62 focus-visible:border-brand-caramel/60 focus-visible:ring-brand-caramel"
                        placeholder="Enter your password"
                        type="password"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              className="h-13 w-full rounded-2xl bg-brand-latte text-base font-semibold text-brand-espresso shadow-[0_20px_60px_rgba(243,233,215,0.16)] transition hover:-translate-y-0.5 hover:bg-brand-cappuccino hover:shadow-[0_26px_72px_rgba(243,233,215,0.22)]"
              disabled={form.formState.isSubmitting || recoveryLoading}
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

            <div className="flex items-start gap-3 rounded-2xl border border-brand-caramel/20 bg-brand-caramel/[0.08] p-3 text-xs leading-5 text-brand-latte/64">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-caramel" />
              <span>
                Login restores backend permissions, branch access, and active workspace context.
              </span>
            </div>

            <p className="text-center text-sm text-brand-cappuccino">
              Need an owner account?{" "}
              <Link
                className="font-medium text-brand-latte underline-offset-4 hover:underline"
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
