"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { getErrorMessage } from "@/lib/api/client";
import { type ResetPasswordSchema, resetPasswordSchema } from "@/validators/auth.schema";

type ResetPasswordFormProps = {
  secret: string;
  userId: string;
};

export function ResetPasswordForm({ secret, userId }: ResetPasswordFormProps): JSX.Element {
  const router = useRouter();
  const { resetPassword } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<ResetPasswordSchema>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
      userId,
      secret,
    },
  });

  useEffect(() => {
    form.setValue("userId", userId);
    form.setValue("secret", secret);
  }, [form, secret, userId]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);

    try {
      await resetPassword(values);
      toast.success("Password updated. You can now sign in.");
      router.replace(ROUTES.login);
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  });

  const linkIsValid = secret.length > 0 && userId.length > 0;

  return (
    <Card className="border-brand-cappuccino/80">
      <CardContent className="space-y-5 p-6 sm:p-8">
        {!linkIsValid ? (
          <Alert variant="destructive">
            <AlertTitle>Invalid reset link</AlertTitle>
            <AlertDescription>
              The recovery link is missing required parameters. Request a new link to continue.
            </AlertDescription>
          </Alert>
        ) : null}

        {submitError ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to reset password</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}

        <Form {...form}>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              void onSubmit(event);
            }}
          >
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="new-password"
                      placeholder="Create a new password"
                      type="password"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Use at least 8 characters with upper, lower, and numeric characters.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="new-password"
                      placeholder="Repeat your new password"
                      type="password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              className="w-full"
              disabled={!linkIsValid || form.formState.isSubmitting}
              type="submit"
            >
              {form.formState.isSubmitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Updating password
                </>
              ) : (
                "Reset password"
              )}
            </Button>
          </form>
        </Form>

        <p className="text-center text-sm text-brand-mocha">
          Need a fresh link?{" "}
          <Link
            className="font-medium text-brand-espresso underline-offset-4 hover:underline"
            href={ROUTES.forgotPassword}
          >
            Request another reset email
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
