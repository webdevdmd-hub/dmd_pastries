"use client";

import { AlertTriangle } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { closeWorkspace } from "@/lib/api/business";
import { getErrorMessage } from "@/lib/api/client";

/**
 * Closing is one-way from inside the business: the auth guard refuses every
 * member of a workspace that is not active, so the person who closes it cannot
 * sign back in to undo it. That is why this asks for the workspace name rather
 * than a yes/no, and says plainly who can reverse it.
 *
 * It is also not deletion. Nothing is removed -- the ledger, stock and
 * documents stay exactly as they are -- so the copy promises "closed", never
 * "deleted", and does not imply the data is gone.
 */
export function CloseWorkspaceCard({
  businessName,
  isOwner,
}: {
  businessName: string;
  isOwner: boolean;
}): JSX.Element | null {
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [isClosing, setIsClosing] = useState(false);

  // Only the owner can close, and the backend enforces it. Hiding it from
  // everyone else keeps the danger zone off the screen of people who cannot
  // act on it anyway.
  if (!isOwner) {
    return null;
  }

  const matches = confirmation.trim() === businessName.trim();

  const submit = async (): Promise<void> => {
    if (!matches || isClosing) {
      return;
    }

    setIsClosing(true);
    try {
      await closeWorkspace({ confirmation: confirmation.trim(), reason: reason.trim() });
      toast.success("Workspace closed. Signing you out.");
      // Every request from here is refused, so staying on the app would just
      // paint errors. Send them somewhere that still answers.
      window.setTimeout(() => {
        window.location.href = "/login";
      }, 1200);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setIsClosing(false);
    }
  };

  return (
    <section aria-labelledby="close-workspace-heading" className="grid gap-4">
      <div className="grid gap-1">
        <h2 className="text-section font-medium" id="close-workspace-heading">
          Close workspace
        </h2>
        <p className="max-w-3xl text-cell text-foreground-muted">
          Stops everyone in this business from signing in. Nothing is deleted.
        </p>
      </div>

      <div className="grid gap-4 rounded-2xl border border-danger/30 bg-danger-tint p-4">
        <div className="flex gap-3">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-danger-text" />
          <div className="grid gap-2 text-cell text-danger-text">
            <p className="font-medium">Only support can reopen a closed workspace.</p>
            <p>
              You will be signed out and will not be able to sign back in. Your records stay as they
              are, and reopening restores everything intact.
            </p>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="close-workspace-reason">Reason (optional)</Label>
          <Input
            id="close-workspace-reason"
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why are you closing it?"
            value={reason}
          />
          <p className="text-meta text-foreground-muted">
            Saved to the audit log, so there is a record after you lose access.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="close-workspace-confirmation">
            Type <span className="font-medium">{businessName}</span> to confirm
          </Label>
          <Input
            autoComplete="off"
            id="close-workspace-confirmation"
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={businessName}
            value={confirmation}
          />
        </div>

        <div>
          <Button
            disabled={!matches || isClosing}
            onClick={() => void submit()}
            type="button"
            variant="danger"
          >
            {isClosing ? "Closing..." : "Close workspace"}
          </Button>
        </div>
      </div>
    </section>
  );
}
