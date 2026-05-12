"use client";

import { CheckCircle2, LoaderCircle, MailPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { getErrorMessage } from "@/lib/api/client";

type VerifyEmailPanelProps = {
  secret: string;
  userId: string;
};

export function VerifyEmailPanel({ secret, userId }: VerifyEmailPanelProps): JSX.Element {
  const router = useRouter();
  const { resendVerification, verifyEmail } = useAuth();
  const [mode, setMode] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (!secret || !userId) {
      return;
    }

    let cancelled = false;

    const runVerification = async (): Promise<void> => {
      setMode("verifying");
      setMessage(null);

      try {
        await verifyEmail(userId, secret);

        if (!cancelled) {
          setMode("success");
          toast.success("Email verified successfully.");
          window.setTimeout(() => {
            router.replace(ROUTES.dashboard);
          }, 1500);
        }
      } catch (error) {
        if (!cancelled) {
          setMode("error");
          setMessage(getErrorMessage(error));
        }
      }
    };

    void runVerification();

    return () => {
      cancelled = true;
    };
  }, [router, secret, userId, verifyEmail]);

  const handleResend = async (): Promise<void> => {
    setResendLoading(true);
    setMessage(null);

    try {
      await resendVerification();
      toast.success("Verification email sent.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <Card className="border-brand-cappuccino/80">
      <CardHeader>
        <Badge className="w-fit">Account security</Badge>
        <CardTitle>Email verification</CardTitle>
        <CardDescription>
          Confirm your email to unlock secure access across your bakery workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {mode === "verifying" ? (
          <Alert>
            <LoaderCircle className="mb-3 h-4 w-4 animate-spin" />
            <AlertTitle>Verifying your email</AlertTitle>
            <AlertDescription>
              Please wait while we validate your verification link.
            </AlertDescription>
          </Alert>
        ) : null}

        {mode === "success" ? (
          <Alert>
            <CheckCircle2 className="mb-3 h-4 w-4" />
            <AlertTitle>Email verified</AlertTitle>
            <AlertDescription>
              Your account is ready. Redirecting you to the dashboard.
            </AlertDescription>
          </Alert>
        ) : null}

        {message ? (
          <Alert variant="destructive">
            <AlertTitle>Verification issue</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        {!secret || !userId ? (
          <Alert>
            <MailPlus className="mb-3 h-4 w-4" />
            <AlertTitle>Need a verification email?</AlertTitle>
            <AlertDescription>
              If you are signed in, you can request a fresh verification link below.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button disabled={resendLoading} onClick={() => void handleResend()} type="button">
            {resendLoading ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Sending email
              </>
            ) : (
              "Resend verification email"
            )}
          </Button>
          <Button asChild variant="outline">
            <Link href={ROUTES.login}>Back to login</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
