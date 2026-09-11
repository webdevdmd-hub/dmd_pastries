"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, MailCheck } from "lucide-react";
import Link from "next/link";
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
import { requestAdminPasswordReset } from "@/lib/api/auth";
import { getErrorMessage } from "@/lib/api/client";
import { type ForgotPasswordSchema, forgotPasswordSchema } from "@/validators/auth.schema";

export function ForgotPasswordForm(): JSX.Element {
  const { forgotPassword } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [submittedVia, setSubmittedVia] = useState<"email" | "admin">("email");
  const [adminRequestPending, setAdminRequestPending] = useState(false);
  const form = useForm<ForgotPasswordSchema>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);

    try {
      await forgotPassword(values);
      setSubmittedVia("email");
      setSubmittedEmail(values.email);
      toast.success("Password reset link sent.");
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  });

  // The no-email path. Validates the same field, then flags the account so a
  // manager sees the request in Staff Management and hands over a link.
  const requestAdminReset = async (): Promise<void> => {
    const valid = await form.trigger("email");
    if (!valid) {
      return;
    }
    setSubmitError(null);
    setAdminRequestPending(true);
    try {
      const email = form.getValues("email");
      await requestAdminPasswordReset({ email });
      setSubmittedVia("admin");
      setSubmittedEmail(email);
      toast.success("Your manager has been notified.");
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    } finally {
      setAdminRequestPending(false);
    }
  };

  return (
    <Card className="border-brand-cappuccino/80">
      <CardContent className="space-y-5 p-6 sm:p-8">
        {submittedEmail ? (
          <Alert>
            <MailCheck className="mb-3 h-4 w-4" />
            <AlertTitle>
              {submittedVia === "admin" ? "Your manager has been notified" : "Check your inbox"}
            </AlertTitle>
            <AlertDescription>
              {submittedVia === "admin" ? (
                <>
                  If <span className="font-medium">{submittedEmail}</span> has an account, it is now
                  marked as needing a reset. Ask your manager for the reset link.
                </>
              ) : (
                <>
                  We sent a recovery link to <span className="font-medium">{submittedEmail}</span>.
                </>
              )}
            </AlertDescription>
          </Alert>
        ) : null}

        {submitError ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to send recovery link</AlertTitle>
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="email"
                      placeholder="owner@bakery.com"
                      type="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button className="w-full" disabled={form.formState.isSubmitting} type="submit">
              {form.formState.isSubmitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Sending link
                </>
              ) : (
                "Send recovery link"
              )}
            </Button>

            <Button
              className="w-full"
              disabled={form.formState.isSubmitting || adminRequestPending}
              onClick={() => void requestAdminReset()}
              type="button"
              variant="outline"
            >
              {adminRequestPending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Notifying your manager
                </>
              ) : (
                "Request admin reset"
              )}
            </Button>
            <p className="text-center text-meta text-foreground-muted">
              No email access? Your manager can give you a reset link in person.
            </p>
          </form>
        </Form>

        <p className="text-center text-sm text-brand-mocha">
          Remembered your password?{" "}
          <Link
            className="font-medium text-brand-espresso underline-offset-4 hover:underline"
            href={ROUTES.login}
          >
            Back to login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
