"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, LoaderCircle, MoreHorizontal, Percent, Plus, ShieldAlert } from "lucide-react";
import type { JSX, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import type { SearchableComboboxOption } from "@/components/shared/searchable-combobox";
import { SearchableCombobox } from "@/components/shared/searchable-combobox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/hooks/use-permission";
import {
  useCompanySettings,
  useCreatePaymentMethod,
  useCreateTaxRate,
  useDeletePaymentMethod,
  useDeleteTaxRate,
  usePaymentMethod,
  usePaymentMethods,
  useSettingsOverview,
  useTaxRates,
  useUpdateCompanySettings,
  useUpdatePaymentMethod,
  useUpdatePaymentMethodStatus,
  useUpdateTaxRate,
  useUpdateTaxRateStatus,
} from "@/hooks/use-settings-data";
import { getPaymentAccounts } from "@/lib/api/accounting";
import { getErrorMessage } from "@/lib/api/client";
import { getBusinessAssetPreviewUrl, uploadBusinessAsset } from "@/lib/appwrite/storage";
import {
  type CompanySettingsSchema,
  companySettingsSchema,
} from "@/lib/validators/company-settings.schema";
import {
  type PaymentMethodSchema,
  paymentMethodSchema,
} from "@/lib/validators/payment-method.schema";
import { type TaxRateSchema, taxRateSchema } from "@/lib/validators/tax-rate.schema";
import type {
  PaymentAccount,
  PaymentAccountsFilters,
  PaymentAccountsResponse,
} from "@/types/accounting";
import type {
  CompanySettings,
  CreatePaymentMethodPayload,
  CreateTaxRatePayload,
  PaymentMethod,
  RecordStatus,
  SettingsOverview,
  TaxRate,
} from "@/types/settings";

type SettingsDataPageKind = "company" | "tax-rates" | "payment-methods";

type SettingsDataPageClientProps = {
  embedded?: boolean;
  kind: SettingsDataPageKind;
};

function StatusBadge({ status }: { status: "active" | "inactive" }): JSX.Element {
  return <Badge variant={status === "active" ? "secondary" : "default"}>{status}</Badge>;
}

function blankTaxRateDefaults(): TaxRateSchema {
  return {
    taxName: "",
    taxType: "VAT",
    ratePercentage: 0,
    isInclusive: false,
    country: "AE",
    region: "",
    isDefault: false,
  };
}

const paymentMethodDefaultValues: PaymentMethodSchema = {
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

const paymentAccountsForMethodsFilters: PaymentAccountsFilters = {
  accountType: "all",
  branchId: "",
  limit: 100,
  page: 1,
  search: "",
  sortBy: "account_name",
  sortOrder: "asc",
  status: "active",
};

function useSettingsPaymentAccounts(enabled: boolean) {
  return useQuery<PaymentAccountsResponse>({
    queryKey: ["settings", "payment-methods", "payment-accounts", paymentAccountsForMethodsFilters],
    queryFn: async () => getPaymentAccounts(paymentAccountsForMethodsFilters),
    enabled,
  });
}

function LoadingCard(): JSX.Element {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="h-32 animate-pulse rounded-3xl bg-brand-cappuccino/30" />
      </CardContent>
    </Card>
  );
}

function ErrorCard({ children }: { children: ReactNode }): JSX.Element {
  return (
    <Alert className="border-danger/30 bg-danger-tint text-danger-text">
      <ShieldAlert className="h-4 w-4" />
      <AlertTitle>Unable to load settings data</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

function CompanyOverviewCards({
  overview,
}: {
  overview: SettingsOverview | undefined;
}): JSX.Element {
  const cards = [
    {
      label: "Profile Status",
      value: overview?.companyProfileCompleted ? "Complete" : "Pending",
      detail: "Required company fields",
    },
    {
      label: "Branches",
      value: String(overview?.branchCount ?? 0),
      detail: "Configured locations",
    },
    {
      label: "Tax Rates",
      value: String(overview?.activeTaxRatesCount ?? 0),
      detail: "Active tax profiles",
    },
    {
      label: "Payment Methods",
      value: String(overview?.activePaymentMethodsCount ?? 0),
      detail: "Active payment options",
    },
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-5">
            <p className="text-xs text-brand-mocha">{card.label}</p>
            <p className="mt-3 font-serif text-3xl text-brand-espresso">{card.value}</p>
            <p className="mt-1 text-sm text-brand-mocha">{card.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CompanySettingsView({ settings }: { settings: CompanySettings }): JSX.Element {
  const fields = [
    ["Display name", settings.businessDisplayName],
    ["Email", settings.email || "Not set"],
    ["Phone", settings.phone || "Not set"],
    ["Website", settings.website || "Not set"],
    ["VAT/TRN", settings.vatNumber || "Not set"],
    ["Currency", settings.currency],
    ["Timezone", settings.timezone],
    ["Address", settings.address || "Not set"],
    ["Invoice footer", settings.invoiceFooter || "Not set"],
    ["Receipt footer", settings.receiptFooter || "Not set"],
  ] as const;

  return (
    <Card>
      <CardContent className="grid gap-4 p-6 md:grid-cols-2">
        {fields.map(([label, value]) => (
          <div
            className="rounded-3xl border border-brand-cappuccino bg-brand-latte/70 p-4"
            key={label}
          >
            <p className="text-xs text-brand-mocha">{label}</p>
            <p className="mt-2 font-medium text-brand-espresso">{value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function toCompanySettingsDefaults(settings: CompanySettings): CompanySettingsSchema {
  return {
    businessDisplayName: settings.businessDisplayName,
    logoUrl: settings.logoUrl,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    website: settings.website,
    vatNumber: settings.vatNumber,
    currency: settings.currency,
    timezone: settings.timezone,
    invoiceFooter: settings.invoiceFooter,
    receiptFooter: settings.receiptFooter,
  };
}

function blankCompanySettingsDefaults(): CompanySettingsSchema {
  return {
    businessDisplayName: "",
    logoUrl: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    vatNumber: "",
    currency: "AED",
    timezone: "Asia/Dubai",
    invoiceFooter: "",
    receiptFooter: "",
  };
}

type CompanySettingsDialogProps = {
  open: boolean;
  settings: CompanySettings | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CompanySettingsSchema) => Promise<void>;
};

function CompanySettingsDialog({
  open,
  settings,
  submitting,
  onOpenChange,
  onSubmit,
}: CompanySettingsDialogProps): JSX.Element {
  const [selectedLogo, setSelectedLogo] = useState<File | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const form = useForm<CompanySettingsSchema>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: settings ? toCompanySettingsDefaults(settings) : blankCompanySettingsDefaults(),
  });

  useEffect(() => {
    if (settings && open) {
      form.reset(toCompanySettingsDefaults(settings));
      setSelectedLogo(null);
    }
  }, [form, open, settings]);

  const previewUrl = useMemo(() => {
    if (selectedLogo) {
      return URL.createObjectURL(selectedLogo);
    }

    return getBusinessAssetPreviewUrl(form.watch("logoUrl") || null);
  }, [form, selectedLogo]);

  useEffect(() => {
    if (!selectedLogo || !previewUrl) {
      return;
    }

    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl, selectedLogo]);

  const handleSubmit = async (values: CompanySettingsSchema): Promise<void> => {
    let logoFileId = values.logoUrl.trim();

    if (selectedLogo) {
      setIsUploadingLogo(true);
      try {
        logoFileId = await uploadBusinessAsset(selectedLogo);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to upload company logo.");
        return;
      } finally {
        setIsUploadingLogo(false);
      }
    }

    await onSubmit({
      ...values,
      logoUrl: logoFileId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Company Settings</DialogTitle>
          <DialogDescription>
            Updates are saved through PATCH /api/v1/settings/company. This action requires
            settings.company.update from the permission matrix.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              void form.handleSubmit(handleSubmit)(event);
            }}
          >
            <FormField
              control={form.control}
              name="businessDisplayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business display name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timezone</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Asia/Dubai" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vatNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>VAT/TRN</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" />
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
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://example.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Company logo</FormLabel>
                  <FormControl>
                    <div className="flex flex-col gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte/50 p-3 sm:flex-row sm:items-center">
                      {previewUrl ? (
                        <img
                          alt="Selected company logo"
                          className="h-20 w-20 rounded-xl object-cover"
                          src={previewUrl}
                        />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-brand-cappuccino/50 text-center text-xs text-brand-mocha">
                          No logo
                        </div>
                      )}
                      <div className="grid flex-1 gap-2">
                        <Input
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            setSelectedLogo(file);
                          }}
                          type="file"
                        />
                        <input type="hidden" {...field} />
                        <p className="text-xs leading-5 text-brand-mocha">
                          Upload a logo to Appwrite Storage. The backend stores the returned file
                          reference in company settings.
                        </p>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <textarea
                      className="min-h-24 w-full rounded-xl border border-brand-cappuccino bg-brand-latte px-3 py-2 text-sm text-brand-espresso placeholder:text-brand-mocha/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-caramel focus-visible:ring-offset-2"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="invoiceFooter"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Invoice footer</FormLabel>
                  <FormControl>
                    <textarea
                      className="min-h-24 w-full rounded-xl border border-brand-cappuccino bg-brand-latte px-3 py-2 text-sm text-brand-espresso placeholder:text-brand-mocha/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-caramel focus-visible:ring-offset-2"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="receiptFooter"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Receipt footer</FormLabel>
                  <FormControl>
                    <textarea
                      className="min-h-24 w-full rounded-xl border border-brand-cappuccino bg-brand-latte px-3 py-2 text-sm text-brand-espresso placeholder:text-brand-mocha/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-caramel focus-visible:ring-offset-2"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="md:col-span-2">
              <Button
                disabled={submitting}
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
              <Button disabled={submitting || isUploadingLogo} type="submit">
                {submitting || isUploadingLogo ? "Saving..." : "Save company settings"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function toTaxRateForm(taxRate: TaxRate | null): TaxRateSchema {
  if (!taxRate) {
    return blankTaxRateDefaults();
  }

  return {
    taxName: taxRate.taxName,
    taxType: taxRate.taxType,
    ratePercentage: taxRate.ratePercentage,
    isInclusive: taxRate.isInclusive,
    country: taxRate.country,
    region: taxRate.region,
    isDefault: taxRate.isDefault,
  };
}

function toTaxRatePayload(values: TaxRateSchema): CreateTaxRatePayload {
  return {
    taxName: values.taxName.trim(),
    taxType: values.taxType.trim(),
    ratePercentage: values.ratePercentage,
    isInclusive: values.isInclusive,
    country: values.country.trim(),
    region: values.region?.trim() ?? "",
    isDefault: values.isDefault,
  };
}

function TaxRateDialog({
  open,
  submitting,
  taxRate,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  submitting: boolean;
  taxRate: TaxRate | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateTaxRatePayload) => Promise<void>;
}): JSX.Element {
  const form = useForm<TaxRateSchema>({
    resolver: zodResolver(taxRateSchema),
    defaultValues: blankTaxRateDefaults(),
  });

  useEffect(() => {
    if (open) {
      form.reset(toTaxRateForm(taxRate));
    }
  }, [form, open, taxRate]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(toTaxRatePayload(values));
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{taxRate ? "Edit tax rate" : "Create tax rate"}</DialogTitle>
          <DialogDescription>
            Tax rates are tenant-scoped. Backend allows only one default tax rate per business.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            <FormField
              control={form.control}
              name="taxName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax name</FormLabel>
                  <FormControl>
                    <Input placeholder="UAE VAT 5%" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="taxType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax type</FormLabel>
                  <FormControl>
                    <Input placeholder="VAT" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ratePercentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate percentage</FormLabel>
                  <FormControl>
                    <Input
                      min={0}
                      max={100}
                      step="0.01"
                      type="number"
                      value={field.value}
                      onChange={(event) => {
                        field.onChange(event.target.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl>
                    <Input placeholder="AE" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="region"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Region</FormLabel>
                  <FormControl>
                    <Input placeholder="Dubai" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isInclusive"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte/70 p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                  </FormControl>
                  <div>
                    <FormLabel>Tax inclusive</FormLabel>
                    <p className="text-xs text-brand-mocha">Prices already include this tax.</p>
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isDefault"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte/70 p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                  </FormControl>
                  <div>
                    <FormLabel>Default tax rate</FormLabel>
                    <p className="text-xs text-brand-mocha">Use as the default business tax.</p>
                  </div>
                </FormItem>
              )}
            />
            <DialogFooter className="md:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Cancel
              </Button>
              <Button disabled={submitting} type="submit">
                {submitting ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : taxRate ? (
                  "Save changes"
                ) : (
                  "Create tax rate"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function TaxRatesTable({
  canManage,
  onDeactivate,
  onEdit,
  onStatusChange,
  taxRates,
}: {
  canManage: boolean;
  onDeactivate: (taxRate: TaxRate) => void;
  onEdit: (taxRate: TaxRate) => void;
  onStatusChange: (taxRate: TaxRate, status: RecordStatus) => void;
  taxRates: TaxRate[];
}): JSX.Element {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Inclusive</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {taxRates.map((taxRate) => (
              <TableRow key={taxRate.id}>
                <TableCell className="font-medium">{taxRate.taxName}</TableCell>
                <TableCell>{taxRate.taxType}</TableCell>
                <TableCell>{taxRate.ratePercentage}%</TableCell>
                <TableCell>
                  {taxRate.country}
                  {taxRate.region ? ` - ${taxRate.region}` : ""}
                </TableCell>
                <TableCell>{taxRate.isInclusive ? "Yes" : "No"}</TableCell>
                <TableCell>{taxRate.isDefault ? "Yes" : "No"}</TableCell>
                <TableCell>
                  <StatusBadge status={taxRate.status} />
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        aria-label={`Open actions for ${taxRate.taxName}`}
                        size="icon"
                        variant="ghost"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem disabled={!canManage} onSelect={() => onEdit(taxRate)}>
                        Edit tax rate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!canManage || taxRate.status === "active"}
                        onSelect={() => onStatusChange(taxRate, "active")}
                      >
                        Activate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!canManage || taxRate.status === "inactive"}
                        onSelect={() => onStatusChange(taxRate, "inactive")}
                      >
                        Mark inactive
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-danger-text focus:text-danger-text"
                        disabled={!canManage}
                        onSelect={() => onDeactivate(taxRate)}
                      >
                        Deactivate through delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PaymentMethodsTable({
  canManage,
  methods,
  onDeactivate,
  onEdit,
  onStatusChange,
}: {
  canManage: boolean;
  methods: PaymentMethod[];
  onDeactivate: (method: PaymentMethod) => void;
  onEdit: (method: PaymentMethod) => void;
  onStatusChange: (method: PaymentMethod, status: RecordStatus) => void;
}): JSX.Element {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Split</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Payment Account</TableHead>
              <TableHead>Visible In</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {methods.map((method) => (
              <TableRow key={method.id}>
                <TableCell className="font-medium">{method.methodName}</TableCell>
                <TableCell>{method.methodType}</TableCell>
                <TableCell>{method.isDefault ? "Yes" : "No"}</TableCell>
                <TableCell>{method.allowSplitPayment ? "Allowed" : "No"}</TableCell>
                <TableCell>{method.requiresReference ? "Required" : "Optional"}</TableCell>
                <TableCell>
                  {method.defaultPaymentAccountName ? (
                    method.defaultPaymentAccountName
                  ) : method.showInPos ? (
                    <span className="text-danger-text">Needs payment account</span>
                  ) : method.showInBakeryOrders ? (
                    <span className="text-danger-text">Setup required</span>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {method.showInPos ? <Badge variant="outline">POS</Badge> : null}
                    {method.showInBakeryOrders ? <Badge variant="outline">Orders</Badge> : null}
                    {method.showInPurchasing ? <Badge variant="outline">Purchasing</Badge> : null}
                    {method.showInExpenses ? <Badge variant="outline">Expenses</Badge> : null}
                    {method.showInDashboardCollection ? (
                      <Badge variant="outline">Dashboard</Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={method.status} />
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        aria-label={`Open actions for ${method.methodName}`}
                        size="icon"
                        variant="ghost"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem disabled={!canManage} onSelect={() => onEdit(method)}>
                        Edit method
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!canManage || method.status === "active"}
                        onSelect={() => onStatusChange(method, "active")}
                      >
                        Activate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!canManage || method.status === "inactive"}
                        onSelect={() => onStatusChange(method, "inactive")}
                      >
                        Mark inactive
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-danger-text focus:text-danger-text"
                        disabled={!canManage}
                        onSelect={() => onDeactivate(method)}
                      >
                        Deactivate through delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

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

function PaymentMethodDialog({
  open,
  method,
  paymentAccounts,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  method: PaymentMethod | null;
  paymentAccounts: PaymentAccount[];
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreatePaymentMethodPayload) => Promise<void>;
}): JSX.Element {
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
    }
  }, [form, method, open]);

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await onSubmit(toPaymentMethodPayload(values));
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{method ? "Edit payment method" : "Create payment method"}</DialogTitle>
          <DialogDescription>
            Configure payment behavior for POS checkout and settlement.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
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
              name="isDefault"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte/70 p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div>
                    <FormLabel>Default method</FormLabel>
                    <p className="text-xs text-brand-mocha">Use as default payment method.</p>
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="allowSplitPayment"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte/70 p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div>
                    <FormLabel>Allow split payment</FormLabel>
                    <p className="text-xs text-brand-mocha">Allow combining payment methods.</p>
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="requiresReference"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte/70 p-4 md:col-span-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div>
                    <FormLabel>Requires reference</FormLabel>
                    <p className="text-xs text-brand-mocha">
                      Require transaction reference for this method.
                    </p>
                  </div>
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
                      emptyMessage="No active payment accounts found."
                      options={paymentAccountOptions}
                      placeholder="Select payment account"
                      searchPlaceholder="Search payment account..."
                      value={field.value ?? ""}
                      onValueChange={(value) => field.onChange(value.length > 0 ? value : null)}
                    />
                  </FormControl>
                  <p className="text-xs text-brand-mocha">
                    Required when this method is visible in POS or Bakery Orders.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-3 rounded-2xl border border-brand-cappuccino bg-brand-latte/50 p-4 md:col-span-2 md:grid-cols-2">
              <p className="md:col-span-2 text-sm font-medium text-brand-espresso">
                Module visibility
              </p>
              {(
                [
                  ["showInPos", "POS"],
                  ["showInBakeryOrders", "Bakery Orders"],
                  ["showInPurchasing", "Purchasing"],
                  ["showInExpenses", "Expenses"],
                  ["showInDashboardCollection", "Dashboard Collection"],
                ] as const
              ).map(([name, label]) => (
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
              <Alert className="md:col-span-2 border-warning/30 bg-warning-tint text-warning-text">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Payment account required for checkout</AlertTitle>
                <AlertDescription>
                  POS and Bakery Order payments need an active linked payment account before this
                  method can be used. If branch-specific mappings are not configured for every
                  checkout branch, saving POS visibility will be rejected.
                </AlertDescription>
              </Alert>
            ) : null}
            {submitError ? (
              <Alert className="md:col-span-2 border-danger/30 bg-danger-tint text-danger-text">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Payment method needs attention</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter className="md:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
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

export function SettingsDataPageClient({
  embedded = false,
  kind,
}: SettingsDataPageClientProps): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.settingsView]);
  const canManagePaymentMethods = hasAnyPermission([PERMISSIONS.settingsPaymentMethodsManage]);
  const canManage = hasAnyPermission([
    PERMISSIONS.settingsCompanyUpdate,
    PERMISSIONS.settingsTaxRatesManage,
    PERMISSIONS.settingsPaymentMethodsManage,
    PERMISSIONS.settingsReceiptUpdate,
    PERMISSIONS.settingsHardwareUpdate,
    PERMISSIONS.settingsNotificationsUpdate,
  ]);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [taxRateDialogOpen, setTaxRateDialogOpen] = useState(false);
  const [selectedTaxRate, setSelectedTaxRate] = useState<TaxRate | null>(null);
  const [paymentMethodDialogOpen, setPaymentMethodDialogOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const companyQuery = useCompanySettings(canView && kind === "company");
  const overviewQuery = useSettingsOverview(canView && kind === "company");
  const updateCompanyMutation = useUpdateCompanySettings();
  const taxRatesQuery = useTaxRates(canView && kind === "tax-rates");
  const createTaxRateMutation = useCreateTaxRate();
  const updateTaxRateMutation = useUpdateTaxRate();
  const updateTaxRateStatusMutation = useUpdateTaxRateStatus();
  const deleteTaxRateMutation = useDeleteTaxRate();
  const paymentMethodDetailQuery = usePaymentMethod(
    selectedPaymentMethod?.id ?? null,
    canView && kind === "payment-methods",
  );
  const paymentMethodsQuery = usePaymentMethods(canView && kind === "payment-methods");
  const paymentAccountsQuery = useSettingsPaymentAccounts(canView && kind === "payment-methods");
  const createPaymentMethodMutation = useCreatePaymentMethod();
  const updatePaymentMethodMutation = useUpdatePaymentMethod();
  const updatePaymentMethodStatusMutation = useUpdatePaymentMethodStatus();
  const deletePaymentMethodMutation = useDeletePaymentMethod();

  const taxRateSubmitting =
    createTaxRateMutation.isPending ||
    updateTaxRateMutation.isPending ||
    updateTaxRateStatusMutation.isPending ||
    deleteTaxRateMutation.isPending;
  const paymentMethodSubmitting =
    createPaymentMethodMutation.isPending ||
    updatePaymentMethodMutation.isPending ||
    updatePaymentMethodStatusMutation.isPending ||
    deletePaymentMethodMutation.isPending;

  const handleCompanySubmit = async (payload: CompanySettingsSchema): Promise<void> => {
    try {
      await updateCompanyMutation.mutateAsync(payload);
      toast.success("Company settings updated.");
      setCompanyDialogOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const openCreateTaxRateDialog = (): void => {
    setSelectedTaxRate(null);
    setTaxRateDialogOpen(true);
  };

  const openEditTaxRateDialog = (taxRate: TaxRate): void => {
    setSelectedTaxRate(taxRate);
    setTaxRateDialogOpen(true);
  };

  const handleTaxRateSubmit = async (payload: CreateTaxRatePayload): Promise<void> => {
    try {
      if (selectedTaxRate) {
        await updateTaxRateMutation.mutateAsync({
          id: selectedTaxRate.id,
          payload,
        });
        toast.success("Tax rate updated.");
      } else {
        await createTaxRateMutation.mutateAsync(payload);
        toast.success("Tax rate created.");
      }

      setTaxRateDialogOpen(false);
      setSelectedTaxRate(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleTaxRateStatusChange = async (
    taxRate: TaxRate,
    status: RecordStatus,
  ): Promise<void> => {
    try {
      await updateTaxRateStatusMutation.mutateAsync({
        id: taxRate.id,
        payload: { status },
      });
      toast.success(`Tax rate marked ${status}.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleTaxRateDeactivate = async (taxRate: TaxRate): Promise<void> => {
    const confirmed = window.confirm(
      `Deactivate ${taxRate.taxName}? The backend keeps the record and marks it inactive.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteTaxRateMutation.mutateAsync(taxRate.id);
      toast.success("Tax rate deactivated.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const openCreatePaymentMethodDialog = (): void => {
    setSelectedPaymentMethod(null);
    setPaymentMethodDialogOpen(true);
  };

  const openEditPaymentMethodDialog = (method: PaymentMethod): void => {
    setSelectedPaymentMethod(method);
    setPaymentMethodDialogOpen(true);
  };

  const handlePaymentMethodSubmit = async (payload: CreatePaymentMethodPayload): Promise<void> => {
    try {
      if (selectedPaymentMethod) {
        await updatePaymentMethodMutation.mutateAsync({
          id: selectedPaymentMethod.id,
          payload,
        });
        toast.success("Payment method updated.");
      } else {
        await createPaymentMethodMutation.mutateAsync(payload);
        toast.success("Payment method created.");
      }

      setPaymentMethodDialogOpen(false);
      setSelectedPaymentMethod(null);
    } catch (error) {
      const message = getErrorMessage(error);
      toast.error(message);
      throw new Error(message);
    }
  };

  const handlePaymentMethodStatusChange = async (
    method: PaymentMethod,
    status: RecordStatus,
  ): Promise<void> => {
    try {
      await updatePaymentMethodStatusMutation.mutateAsync({
        id: method.id,
        payload: { status },
      });
      toast.success(`Payment method marked ${status}.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handlePaymentMethodDeactivate = async (method: PaymentMethod): Promise<void> => {
    const confirmed = window.confirm(
      `Deactivate ${method.methodName}? The backend keeps the record and marks it inactive.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deletePaymentMethodMutation.mutateAsync(method.id);
      toast.success("Payment method deactivated.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (!canView) {
    return (
      <div className="mx-auto max-w-3xl">
        <Alert className="border-brand-cappuccino bg-card/80">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access denied</AlertTitle>
          <AlertDescription>You need settings.view permission to view this page.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (kind === "company") {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <PageHeader
          title="Company Settings"
          description="Review and manage company identity, contact details, currency, timezone, and receipt text."
          actions={
            canManage && companyQuery.data ? (
              <Button
                onClick={() => {
                  setCompanyDialogOpen(true);
                }}
              >
                Edit Company Settings
              </Button>
            ) : null
          }
        />
        <CompanyOverviewCards overview={overviewQuery.data} />
        {!canManage ? (
          <Alert className="border-brand-cappuccino bg-card/80">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>View only</AlertTitle>
            <AlertDescription>
              Your role has settings.view permission. Editing requires the matching granular
              settings permission in the permission matrix.
            </AlertDescription>
          </Alert>
        ) : null}
        {companyQuery.isLoading ? <LoadingCard /> : null}
        {companyQuery.error ? <ErrorCard>{getErrorMessage(companyQuery.error)}</ErrorCard> : null}
        {companyQuery.data ? <CompanySettingsView settings={companyQuery.data} /> : null}
        <CompanySettingsDialog
          open={companyDialogOpen}
          settings={companyQuery.data ?? null}
          submitting={updateCompanyMutation.isPending}
          onOpenChange={setCompanyDialogOpen}
          onSubmit={handleCompanySubmit}
        />
      </div>
    );
  }

  if (kind === "tax-rates") {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <PageHeader
          title="Tax Rates"
          description="Manage VAT, GST, sales tax, service charges, and regional tax profiles."
          actions={
            canManage ? (
              <Button onClick={openCreateTaxRateDialog}>
                <Plus className="h-4 w-4" />
                Create tax rate
              </Button>
            ) : null
          }
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-brand-espresso">
              <Percent className="h-5 w-5" />
              Active tax configuration
            </CardTitle>
          </CardHeader>
        </Card>
        {taxRatesQuery.isLoading ? <LoadingCard /> : null}
        {taxRatesQuery.error ? <ErrorCard>{getErrorMessage(taxRatesQuery.error)}</ErrorCard> : null}
        {taxRatesQuery.data ? (
          <TaxRatesTable
            canManage={canManage}
            taxRates={taxRatesQuery.data}
            onDeactivate={(taxRate) => {
              void handleTaxRateDeactivate(taxRate);
            }}
            onEdit={openEditTaxRateDialog}
            onStatusChange={(taxRate, status) => {
              void handleTaxRateStatusChange(taxRate, status);
            }}
          />
        ) : null}
        <TaxRateDialog
          open={taxRateDialogOpen}
          submitting={taxRateSubmitting}
          taxRate={selectedTaxRate}
          onOpenChange={setTaxRateDialogOpen}
          onSubmit={handleTaxRateSubmit}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      {embedded ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-brand-espresso">Payment methods</h2>
            <p className="text-sm text-brand-mocha">
              Manage how customers pay and connect each method to a payment account.
            </p>
          </div>
          {canManagePaymentMethods ? (
            <Button onClick={openCreatePaymentMethodDialog}>
              <Plus className="h-4 w-4" />
              Create payment method
            </Button>
          ) : null}
        </div>
      ) : (
        <PageHeader
          title="Payment Methods & Accounts"
          description="Choose how customers pay, then link where that money is recorded."
          actions={
            canManagePaymentMethods ? (
              <Button onClick={openCreatePaymentMethodDialog}>
                <Plus className="h-4 w-4" />
                Create payment method
              </Button>
            ) : null
          }
        />
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-brand-espresso">
            <CreditCard className="h-5 w-5" />
            Payment configuration
          </CardTitle>
        </CardHeader>
      </Card>
      {paymentMethodsQuery.isLoading ? <LoadingCard /> : null}
      {paymentMethodsQuery.error ? (
        <ErrorCard>{getErrorMessage(paymentMethodsQuery.error)}</ErrorCard>
      ) : null}
      {paymentMethodsQuery.data ? (
        <PaymentMethodsTable
          canManage={canManagePaymentMethods}
          methods={paymentMethodsQuery.data}
          onDeactivate={(method) => {
            void handlePaymentMethodDeactivate(method);
          }}
          onEdit={openEditPaymentMethodDialog}
          onStatusChange={(method, status) => {
            void handlePaymentMethodStatusChange(method, status);
          }}
        />
      ) : null}
      <PaymentMethodDialog
        open={paymentMethodDialogOpen}
        method={paymentMethodDetailQuery.data ?? selectedPaymentMethod}
        paymentAccounts={paymentAccountsQuery.data?.items ?? []}
        submitting={paymentMethodSubmitting}
        onOpenChange={setPaymentMethodDialogOpen}
        onSubmit={handlePaymentMethodSubmit}
      />
    </div>
  );
}
