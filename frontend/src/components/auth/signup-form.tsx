"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Building2,
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

export function SignupForm(): JSX.Element {
  const router = useRouter();
  const { register } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
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
            form.setError(field, { message: firstMessage });
          }
        });
      }

      if (isDuplicateIdentityError(error)) {
        form.setError("email", {
          message: "This email may already exist in Appwrite. Try a different email address.",
        });
        form.setError("phone", {
          message: "This phone may already exist in Appwrite. Try a different phone number.",
        });
      }

      setSubmitError(getErrorMessage(error));
    }
  });

  return (
    <Card className="border-white/10 bg-white/[0.07] shadow-none backdrop-blur-xl">
      <CardContent className="p-4 sm:p-6">
        <Form {...form}>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              void onSubmit(event);
            }}
          >
            {submitError ? (
              <Alert className="border-red-300/30 bg-red-500/10 text-red-100" variant="destructive">
                <AlertTitle>Unable to create account</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-brand-latte">Full name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-cappuccino" />
                        <Input
                          autoComplete="name"
                          className="h-14 rounded-2xl border-white/10 bg-brand-latte/10 pl-11 text-brand-latte placeholder:text-brand-cappuccino/65 focus-visible:ring-brand-caramel"
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
                    <FormLabel className="text-brand-latte">Business name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Building2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-cappuccino" />
                        <Input
                          className="h-14 rounded-2xl border-white/10 bg-brand-latte/10 pl-11 text-brand-latte placeholder:text-brand-cappuccino/65 focus-visible:ring-brand-caramel"
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
                    <FormLabel className="text-brand-latte">Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-cappuccino" />
                        <Input
                          autoComplete="email"
                          className="h-14 rounded-2xl border-white/10 bg-brand-latte/10 pl-11 text-brand-latte placeholder:text-brand-cappuccino/65 focus-visible:ring-brand-caramel"
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
                    <FormLabel className="text-brand-latte">Phone</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-cappuccino" />
                        <Input
                          autoComplete="tel"
                          className="h-14 rounded-2xl border-white/10 bg-brand-latte/10 pl-11 text-brand-latte placeholder:text-brand-cappuccino/65 focus-visible:ring-brand-caramel"
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
                    <FormLabel className="text-brand-latte">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-cappuccino" />
                        <Input
                          autoComplete="new-password"
                          className="h-14 rounded-2xl border-white/10 bg-brand-latte/10 pl-11 text-brand-latte placeholder:text-brand-cappuccino/65 focus-visible:ring-brand-caramel"
                          placeholder="Create a strong password"
                          type="password"
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
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-brand-latte">Confirm password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-cappuccino" />
                        <Input
                          autoComplete="new-password"
                          className="h-14 rounded-2xl border-white/10 bg-brand-latte/10 pl-11 text-brand-latte placeholder:text-brand-cappuccino/65 focus-visible:ring-brand-caramel"
                          placeholder="Repeat your password"
                          type="password"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              className="h-14 w-full rounded-2xl bg-brand-caramel text-base font-semibold text-brand-latte shadow-[0_18px_40px_rgba(176,137,104,0.28)] transition hover:-translate-y-0.5 hover:bg-brand-mocha hover:shadow-[0_24px_55px_rgba(176,137,104,0.36)]"
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

            <p className="text-center text-sm text-brand-cappuccino">
              Already have access?{" "}
              <Link
                className="font-medium text-brand-latte underline-offset-4 hover:underline"
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
