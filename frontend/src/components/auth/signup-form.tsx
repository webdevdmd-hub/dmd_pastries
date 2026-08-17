"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { type SignupSchema, signupSchema } from "@/validators/auth.schema";

function isSignupFieldName(value: string): value is keyof SignupSchema {
  return (
    value === "fullName" ||
    value === "businessName" ||
    value === "email" ||
    value === "phone" ||
    value === "password" ||
    value === "confirmPassword"
  );
}

function isDuplicateIdentityError(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }

  return /same id, email, or phone already exists/i.test(error.message);
}

function getSignupErrorMessage(error: unknown): string {
  const message = (typeof error === "string" ? error : getErrorMessage(error)).toLowerCase();

  if (message.includes("phone")) {
    return "Check your phone number.";
  }

  if (
    message.includes("already exists") ||
    message.includes("user_already_exists") ||
    message.includes("duplicate")
  ) {
    return "Account already exists.";
  }

  if (message.includes("password")) {
    return "Check your password.";
  }

  if (message.includes("unable to reach") || message.includes("network")) {
    return "Unable to connect. Try again.";
  }

  if (
    message.includes("scope") ||
    message.includes("project") ||
    (error instanceof ApiError && error.status >= 500)
  ) {
    return "Registration is temporarily unavailable.";
  }

  if (error instanceof ApiError && error.status === 400) {
    return "Check the highlighted fields.";
  }

  return "Registration failed. Try again.";
}

function getSignupFieldError(field: keyof SignupSchema, message: string): string {
  const normalizedMessage = message.toLowerCase();
  const duplicate =
    normalizedMessage.includes("already exists") ||
    normalizedMessage.includes("duplicate") ||
    normalizedMessage.includes("already in use");

  switch (field) {
    case "fullName":
      return "Enter your full name.";
    case "businessName":
      return "Enter your business name.";
    case "email":
      return duplicate ? "Email already in use." : "Enter a valid email address.";
    case "phone":
      return duplicate ? "Phone already in use." : "Enter a valid phone number.";
    case "password":
      return "Use 8+ characters with uppercase, lowercase, and a number.";
    case "confirmPassword":
      return "Passwords do not match.";
  }
}

const labelClassName = "text-sm font-medium text-foreground";
const iconClassName =
  "pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted";
const inputClassName =
  "h-12 rounded-lg border-border bg-card pl-11 text-foreground shadow-none transition placeholder:text-foreground-disabled focus-visible:border-ring focus-visible:ring-ring/40";

export function SignupForm(): JSX.Element {
  const router = useRouter();
  const { register } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const form = useForm<SignupSchema>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      businessName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);

    try {
      const result = await register(values);
      toast.success(result.message || "Your bakery owner account has been created.");
      router.replace(result.redirectTo);
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        Object.entries(error.errors).forEach(([field, messages]) => {
          const firstMessage = messages[0];

          if (isSignupFieldName(field) && firstMessage) {
            form.setError(field, { message: getSignupFieldError(field, firstMessage) });
          }
        });
      }

      if (isDuplicateIdentityError(error)) {
        form.setError("email", {
          message: "Email already in use.",
        });
        form.setError("phone", {
          message: "Phone already in use.",
        });
      }

      if (getErrorMessage(error).toLowerCase().includes("phone")) {
        form.setError("phone", {
          message: "Use country code, for example +971501234567.",
        });
      }

      setSubmitError(getErrorMessage(error));
    }
  });

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
            {submitError ? (
              <Alert
                className="border-danger/30 bg-danger-tint text-danger-text"
                variant="destructive"
              >
                <AlertDescription>{getSignupErrorMessage(submitError)}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClassName}>Full name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <UserRound className={iconClassName} />
                        <Input
                          autoComplete="name"
                          className={inputClassName}
                          placeholder="Mina Hassan"
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
                name="businessName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClassName}>Business name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Building2 className={iconClassName} />
                        <Input
                          className={inputClassName}
                          placeholder="Golden Crust Bakery"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClassName}>Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className={iconClassName} />
                        <Input
                          autoComplete="email"
                          className={inputClassName}
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
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClassName}>Phone</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className={iconClassName} />
                        <Input
                          autoComplete="tel"
                          className={inputClassName}
                          placeholder="+971 50 000 0000"
                          type="tel"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClassName}>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <LockKeyhole className={iconClassName} />
                        <Input
                          autoComplete="new-password"
                          className={`${inputClassName} pr-11`}
                          placeholder="Create a strong password"
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
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={labelClassName}>Confirm password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <LockKeyhole className={iconClassName} />
                        <Input
                          autoComplete="new-password"
                          className={`${inputClassName} pr-11`}
                          placeholder="Repeat your password"
                          type={showConfirmPassword ? "text" : "password"}
                          {...field}
                        />
                        <button
                          aria-label={
                            showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                          }
                          aria-pressed={showConfirmPassword}
                          className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-foreground-muted transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
                          onClick={() => {
                            setShowConfirmPassword((current) => !current);
                          }}
                          title={
                            showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                          }
                          type="button"
                        >
                          {showConfirmPassword ? (
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
            </div>

            <Button
              className="h-12 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-none transition hover:bg-primary"
              disabled={form.formState.isSubmitting}
              type="submit"
            >
              {form.formState.isSubmitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Creating account
                </>
              ) : (
                <>
                  Create owner account
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <p className="text-center text-sm text-foreground-muted">
              Already have access?{" "}
              <Link
                className="font-medium text-foreground underline-offset-4 hover:underline"
                href={ROUTES.login}
              >
                Login
              </Link>
            </p>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
