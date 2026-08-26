"use client";

import { X } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAssignCustomerTag,
  useCreateCustomerTag,
  useCustomerAssignedTags,
  useCustomerTags,
  useRemoveCustomerTag,
} from "@/hooks/use-customers";
import { getErrorMessage } from "@/lib/api/client";
import {
  type CreateCustomerTagFormValues,
  createCustomerTagSchema,
} from "@/lib/validators/customer.schema";
import type { Customer } from "@/types/customer";

export function CustomerTagsSection({
  canManage,
  customer,
}: {
  canManage: boolean;
  customer: Customer;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#B08968");
  const tagsQuery = useCustomerTags();
  const assignedTagsQuery = useCustomerAssignedTags(customer.id);
  const createMutation = useCreateCustomerTag();
  const assignMutation = useAssignCustomerTag();
  const removeMutation = useRemoveCustomerTag();
  const assignedTags = assignedTagsQuery.data ?? customer.tags;
  const assignedTagIds = new Set(assignedTags.map((tag) => tag.id));
  const availableTags = (tagsQuery.data ?? []).filter((tag) => !assignedTagIds.has(tag.id));

  const createTag = async (): Promise<void> => {
    const parsed = createCustomerTagSchema.safeParse({
      tagName,
      color: tagColor,
    } satisfies CreateCustomerTagFormValues);

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid tag details.");
      return;
    }

    try {
      const tag = await createMutation.mutateAsync({
        tagName: parsed.data.tagName,
        color: parsed.data.color ?? null,
      });
      await assignMutation.mutateAsync({ customerId: customer.id, payload: { tagId: tag.id } });
      toast.success("Tag created and assigned.");
      setTagName("");
      setTagColor("#B08968");
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const assignTag = async (tagId: string): Promise<void> => {
    try {
      await assignMutation.mutateAsync({ customerId: customer.id, payload: { tagId } });
      toast.success("Tag assigned.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const removeTag = async (tagId: string): Promise<void> => {
    try {
      await removeMutation.mutateAsync({ customerId: customer.id, tagId });
      toast.success("Tag removed.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Card className="bg-card/80">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Tags</CardTitle>
        {canManage ? (
          <Button onClick={() => setOpen(true)} size="sm" type="button" variant="outline">
            Create tag
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {assignedTags.length > 0 ? (
            assignedTags.map((tag) => (
              <Badge
                className="gap-2"
                key={tag.id}
                style={tag.color ? { borderColor: tag.color } : undefined}
                variant="secondary"
              >
                {tag.tagName}
                {canManage ? (
                  <button
                    aria-label={`Remove ${tag.tagName}`}
                    className="rounded-full p-0.5 hover:bg-brand-cappuccino"
                    disabled={removeMutation.isPending}
                    onClick={() => {
                      void removeTag(tag.id);
                    }}
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-brand-mocha">No tags assigned yet.</p>
          )}
        </div>

        {canManage ? (
          <div className="space-y-2">
            <p className="text-xs font-bold text-brand-mocha">Assign existing tag</p>
            {availableTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <Button
                    disabled={assignMutation.isPending}
                    key={tag.id}
                    onClick={() => {
                      void assignTag(tag.id);
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {tag.tagName}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-brand-mocha">No unassigned reusable tags available.</p>
            )}
          </div>
        ) : null}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create customer tag</DialogTitle>
            <DialogDescription>
              Create a reusable tag and assign it to this customer.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="customer-tag-name">Tag name</Label>
            <Input
              id="customer-tag-name"
              onChange={(event) => setTagName(event.target.value)}
              value={tagName}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="customer-tag-color">Color</Label>
            <Input
              id="customer-tag-color"
              onChange={(event) => setTagColor(event.target.value)}
              placeholder="#B08968"
              value={tagColor}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={createMutation.isPending}
              onClick={() => {
                void createTag();
              }}
              type="button"
            >
              Create tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
