"use client";

import { Check, Copy } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useState } from "react";

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

// The app has no mailer, so an invitation is a link the manager hands over
// themselves -- by message, or by reading it out at the counter. The backend
// stores only a hash of the token, so this is the one moment the link exists
// in plain text; "Resend invitation" mints a fresh one when it is lost.
export type InvitationLink = {
  email: string;
  token: string;
};

type InvitationLinkDialogProps = {
  link: InvitationLink | null;
  onClose: () => void;
};

export function buildInvitationUrl(token: string, origin: string): string {
  return `${origin}${ROUTES.acceptInvitation}?token=${encodeURIComponent(token)}`;
}

export function InvitationLinkDialog({ link, onClose }: InvitationLinkDialogProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const url = link
    ? buildInvitationUrl(link.token, typeof window === "undefined" ? "" : window.location.origin)
    : "";

  useEffect(() => {
    setCopied(false);
  }, [link]);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard access is denied in some embedded browsers; the field stays
      // selectable, so the link can still be copied by hand.
      setCopied(false);
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
          <DialogTitle>Invitation link</DialogTitle>
          <DialogDescription>
            {link ? `Send this link to ${link.email}. ` : ""}
            It is shown once; use Resend invitation if it is lost.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={url}
            onFocus={(event) => event.currentTarget.select()}
            aria-label="Invitation link"
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
