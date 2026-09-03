"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, ShieldAlert } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { type FormTab, FormTabs } from "@/components/shared/form-tabs";
import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/api/client";
import {
  type PaymentMethodSchema,
  paymentMethodSchema,
} from "@/lib/validators/payment-method.schema";
import type { PaymentAccount } from "@/types/accounting";
import type { CreatePaymentMethodPayload, PaymentMethod } from "@/types/settings";

type PaymentMethodFormTabKey = "details" | "visibility";

const FORM_TABPANEL_ID = "payment-method-form-tabpanel";

/** Which tab each field lives on, so a validation error can open the right one. */
const FIELD_TABS: Record<keyof PaymentMethodSchema, PaymentMethodFormTabKey> = {
  methodName: "details",
  methodType: "details",
  isDefault: "details",
  allowSplitPayment: "details",
  requiresReference: "details",
  defaultPaymentAccountId: "details",
  showInPos: "visibility",
  showInBakeryOrders: "visibility",
  showInPurchasing: "visibility",
  showInExpenses: "visibility",
  showInDashboardCollection: "visibility",
};

const MODULE_FIELDS = [
  ["showInPos", "POS"],
  ["showInBakeryOrders", "Bakery Orders"],
  ["showInPurchasing", "Purchasing"],
  ["showInExpenses", "Expenses"],
  ["showInDashboardCollection", "Dashboard Collection"],
] as const;

export const paymentMethodDefaultValues: PaymentMethodSchema = {
  methodName: "",
  methodType: "",
  isDefault: false,
  allowSplitPayment: false,
  requiresReference: false,
  showInPos: false,
  showInBakeryOrders: true,
  showInPurchasing: false,
  showInExpenses: false,
  showInDashboardCollection: true,
  defaultPaymentAccountId: null,
};

function toPaymentMethodForm(method: PaymentMethod | null): PaymentMethodSchema {
  if (!method) {
    return paymentMethodDefaultValues;
  }

  return {
    methodName: method.methodName,
    methodType: method.methodType,
    isDefault: method.isDefault,
    allowSplitPayment: method.allowSplitPayment,
    requiresReference: method.requiresReference,
    showInPos: method.showInPos,
    showInBakeryOrders: method.showInBakeryOrders,
    showInPurchasing: method.showInPurchasing,
    showInExpenses: method.showInExpenses,
    showInDashboardCollection: method.showInDashboardCollection,
    defaultPaymentAccountId: method.defaultPaymentAccountId,
  };
}

function toPaymentMethodPayload(values: PaymentMethodSchema): CreatePaymentMethodPayload {
  return {
    methodName: values.methodName.trim(),
    methodType: values.methodType.trim(),
    isDefault: values.isDefault,
    allowSplitPayment: values.allowSplitPayment,
    requiresReference: values.requiresReference,
    showInPos: values.showInPos,
    showInBakeryOrders: values.showInBakeryOrders,
    showInPurchasing: values.showInPurchasing,
    showInExpenses: values.showInExpenses,
    showInDashboardCollection: values.showInDashboardCollection,
    defaultPaymentAccountId: values.defaultPaymentAccountId,
  };
}

/**
 * Create or edit a payment method, in two tabs: what it is and where it
 * shows. One react-hook-form instance holds every field, so nothing typed on
 * the other tab is lost. A failed submit switches to the first tab that has
 * an error and badges each tab with its count.
 */
export function PaymentMethodDialog({
  method,
  onOpenChange,
  onSubmit,
  open,
  paymentAccounts,
  submitting,
}: {
  method: PaymentMethod | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreatePaymentMethodPayload) => Promise<void>;
  open: boolean;
  paymentAccounts: PaymentAccount[];
  submitting: boolean;
}): JSX.Element {
  const [activeTab, setActiveTab] = useState<PaymentMethodFormTabKey>("details");
  const paymentAccountOptions = useMemo<SearchableComboboxOption[]>(
    () =>
      paymentAccounts
        .filter((account) => account.status === "active")
        .map((account) => ({
          value: account.id,
          label: account.accountName,
          description: `${account.accountType.replaceAll("_", " ")} / ${account.chartAccountName}`,
          keywords: [account.accountName, account.accountType, account.chartAccountName],
        })),
    [paymentAccounts],
  );
  const form = useForm<PaymentMethodSchema>({
    resolver: zodResolver(paymentMethodSchema),
    defaultValues: paymentMethodDefaultValues,
  });
  const watchShowInPos = form.watch("showInPos");
  const watchShowInBakeryOrders = form.watch("showInBakeryOrders");
  const watchPaymentAccountId = form.watch("defaultPaymentAccountId");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      form.reset(toPaymentMethodForm(method));
      setSubmitError(null);
      // Every opening starts on Details, whichever tab the last one closed on.
      setActiveTab("details");
    }
  }, [form, method, open]);

  const errors = form.formState.errors;
  const errorCount = (tab: PaymentMethodFormTabKey): number =>
    (Object.keys(errors) as (keyof PaymentMethodSchema)[]).filter(
      (field) => FIELD_TABS[field] === tab,
    ).length;
  const tabs: FormTab<PaymentMethodFormTabKey>[] = [
    { key: "details", label: "Details", badge: errorCount("details") },
    { key: "visibility", label: "Visibility", badge: errorCount("visibility") },
  ];

  const handleSubmit = form.handleSubmit(
    async (values) => {
      setSubmitError(null);
      try {
        await onSubmit(toPaymentMethodPayload(values));
      } catch (error) {
        setSubmitError(getErrorMessage(error));
      }
    },
    (invalid) => {
      const firstField = (Object.keys(invalid) as (keyof PaymentMethodSchema)[])[0];
      if (firstField) {
        setActiveTab(FIELD_TABS[firstField]);
      }
    },
  );

  const checkboxRow = (
    name: "isDefault" | "allowSplitPayment" | "requiresReference",
    label: string,
    hint: string,
  ): JSX.Element => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-center gap-3 rounded-lg bg-muted p-3">
          <FormControl>
            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
          </FormControl>
          <div>
            <FormLabel>{label}</FormLabel>
            <p className="text-meta text-foreground-muted">{hint}</p>
          </div>
        </FormItem>
      )}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
          <DialogTitle>{method ? "Edit payment method" : "Create payment method"}</DialogTitle>
          <DialogDescription>
            Configure payment behavior for POS checkout and settlement.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            <div className="border-b border-border px-6 py-3">
              <FormTabs
                active={activeTab}
                aria-label="Payment method form sections"
                onTabChange={setActiveTab}
                panelId={FORM_TABPANEL_ID}
                tabs={tabs}
              />
            </div>

            {/* One panel element that swaps. It is the only part that scrolls,
                so the tab strip and the footer stay in reach on a phone. */}
            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5"
              id={FORM_TABPANEL_ID}
              role="tabpanel"
              tabIndex={-1}
            >
              {activeTab === "details" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="methodName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Method name</FormLabel>
                        <FormControl>
                          <Input placeholder="Card" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="methodType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Method type</FormLabel>
                        <FormControl>
                          <Input placeholder="card" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="defaultPaymentAccountId"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Default payment account</FormLabel>
                        <FormControl>
                          <SearchableCombobox
                            emptyMessage="No active payment accounts."
                            options={paymentAccountOptions}
                            placeholder="Select payment account"
                            searchPlaceholder="Search payment account..."
                            value={field.value ?? ""}
                            onValueChange={(value) =>
                              field.onChange(value.length > 0 ? value : null)
                            }
                          />
                        </FormControl>
                        <p className="text-meta text-foreground-muted">
                          Required when this method is visible in POS or Bakery Orders.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {checkboxRow("isDefault", "Default method", "Use as default payment method.")}
                  {checkboxRow(
                    "allowSplitPayment",
                    "Allow split payment",
                    "Allow combining payment methods.",
                  )}
                  <div className="md:col-span-2">
                    {checkboxRow(
                      "requiresReference",
                      "Requires reference",
                      "Require a transaction reference for this method.",
                    )}
                  </div>
                </div>
              ) : null}

              {activeTab === "visibility" ? (
                <div className="grid gap-4">
                  <div className="grid gap-3 rounded-lg bg-muted p-4 md:grid-cols-2">
                    <p className="text-cell font-medium md:col-span-2">Module visibility</p>
                    {MODULE_FIELDS.map(([name, label]) => (
                      <FormField
                        key={name}
                        control={form.control}
                        name={name}
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-3">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <FormLabel className="font-normal">{label}</FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  {(watchShowInPos || watchShowInBakeryOrders) && !watchPaymentAccountId ? (
                    <Alert className="border-warning/30 bg-warning-tint text-warning-text">
                      <ShieldAlert className="h-4 w-4" />
                      <AlertTitle>Payment account required for checkout</AlertTitle>
                      <AlertDescription>
                        POS and Bakery Order payments need an active linked payment account on the
                        Details tab before this method can be used. If branch-specific mappings are
                        not configured for every checkout branch, saving POS visibility will be
                        rejected.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              ) : null}

              {submitError ? (
                <Alert className="mt-4 border-danger/30 bg-danger-tint text-danger-text">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>Payment method needs attention</AlertTitle>
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              ) : null}
            </div>

            <DialogFooter className="border-t border-border px-6 py-4">
              <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
                Cancel
              </Button>
              <Button disabled={submitting} type="submit">
                {submitting ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : method ? (
                  "Save changes"
                ) : (
                  "Create payment method"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
