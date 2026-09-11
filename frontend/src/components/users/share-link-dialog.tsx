"use client";

import { Check, Copy } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/constants/routes";

// The app has no mailer, so anything that would be emailed elsewhere -- an
// invitation, a password reset -- is a link the manager hands over themselves,
// by message or by reading it out at the counter. The backend stores only a
// hash of the token, so this is the one moment the link exists in plain text.
export type ShareLink = {
  title: string;
  description: string;
  url: string;
};

type ShareLinkDialogProps = {
  link: ShareLink | null;
  onClose: () => void;
};

export function buildInvitationUrl(token: string, origin: string): string {
  return `${origin}${ROUTES.acceptInvitation}?token=${encodeURIComponent(token)}`;
}

export function invitationLink(email: string, token: string): ShareLink {
  return {
    title: "Invitation link",
    description: `Send this link to ${email}. It is shown once; use Resend invitation if it is lost.`,
    url: buildInvitationUrl(token, typeof window === "undefined" ? "" : window.location.origin),
  };
}

export function passwordResetLink(email: string, url: string): ShareLink {
  return {
    title: "Password reset link",
    description: `Give this link to ${email}. It works once and expires in an hour; issue a new one if it is lost.`,
    url,
  };
}

/**
 * Copy with a fallback. navigator.clipboard is undefined on plain-http
 * origins and can be refused by permission policy inside embedded browsers
 * -- both seen on shop terminals. The old execCommand path still works there
 * as long as the text is selected first, and if even that fails the user is
 * told, instead of a button that silently does nothing.
 */
async function copyText(text: string, input: HTMLInputElement | null): Promise<boolean> {
  try {
    if (window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the selection-based path.
  }

  if (!input) {
    return false;
  }
  input.focus();
  input.select();
  input.setSelectionRange(0, text.length);
  try {
    // Deprecated, and still the only copy path that works without a secure
    // context or a clipboard permission. Kept as the fallback on purpose.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return document.execCommand("copy");
  } catch {
    return false;
  }
}

export function ShareLinkDialog({ link, onClose }: ShareLinkDialogProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCopied(false);
  }, [link]);

  const copy = async (): Promise<void> => {
    if (!link) {
      return;
    }
    const ok = await copyText(link.url, inputRef.current);
    setCopied(ok);
    if (ok) {
      toast.success("Link copied.");
    } else {
      toast.error("Could not copy automatically. The link is selected; press Ctrl+C.");
    }
  };

  return (
    <Dialog
      open={link !== null}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{link?.title ?? "Link"}</DialogTitle>
          <DialogDescription>{link?.description ?? ""}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            readOnly
            value={link?.url ?? ""}
            onFocus={(event) => event.currentTarget.select()}
            aria-label={link?.title ?? "Link"}
            className="font-mono text-xs"
          />
          <Button type="button" variant="outline" onClick={() => void copy()}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
