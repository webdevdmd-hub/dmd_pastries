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
import { useAcceptStaffInvitation } from "@/hooks/use-invitations";
import { getErrorMessage } from "@/lib/api/client";
import { type AcceptInvitationSchema, acceptInvitationSchema } from "@/lib/validators/user.schema";

type AcceptInvitationFormProps = {
  token: string;
};

export function AcceptInvitationForm({ token }: AcceptInvitationFormProps): JSX.Element {
  const router = useRouter();
  const acceptInvitationMutation = useAcceptStaffInvitation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<AcceptInvitationSchema>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: {
      token,
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    form.setValue("token", token);
  }, [form, token]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);

    try {
      await acceptInvitationMutation.mutateAsync(values);
      toast.success("Invitation accepted. You can now sign in.");
      router.replace(ROUTES.login);
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  });

  const tokenIsValid = token.length > 0;

  return (
    <Card className="border-brand-cappuccino/80">
      <CardContent className="space-y-5 p-6 sm:p-8">
        {!tokenIsValid ? (
          <Alert variant="destructive">
            <AlertTitle>Invalid invitation link</AlertTitle>
            <AlertDescription>
              This invitation link is missing its token. Ask your manager to resend the invitation.
            </AlertDescription>
          </Alert>
        ) : null}

        {submitError ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to accept invitation</AlertTitle>
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
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="new-password"
                      placeholder="Create your password"
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
                      placeholder="Repeat your password"
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
              disabled={!tokenIsValid || acceptInvitationMutation.isPending}
              type="submit"
            >
              {acceptInvitationMutation.isPending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Activating account
                </>
              ) : (
                "Accept invitation"
              )}
            </Button>
          </form>
        </Form>

        <p className="text-center text-sm text-brand-mocha">
          Already activated?{" "}
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
