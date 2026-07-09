"use client";

import type { JSX } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useManufacturingRecipeByProduct, useProductionPreview } from "@/hooks/use-manufacturing";
import {
  EMPTY_BOM_PRODUCTION_MESSAGE,
  PREVIEW_OUT_OF_SYNC_MESSAGE,
  PREVIEW_REQUIRED_MESSAGE,
  productionFailureMessage,
  type ProductionFeedback,
  recipeHasKnownEmptyBom,
} from "@/lib/manufacturing/production-errors";
import {
  createBatchSchema,
  createProductionSchema,
  produceSchema,
} from "@/lib/validators/manufacturing.schema";
import type {
  CreateBatchPayload,
  CreateProductionPayload,
  ManufacturingBranchOption,
  ManufacturingProductOption,
  ManufacturingRecipeOption,
  ProducePayload,
  ProductionBatch,
  ProductionPreviewLineItem,
  UpdateBatchPayload,
} from "@/types/manufacturing";
import { ITEM_STRUCTURE_LABELS, PRODUCT_TYPE_LABELS } from "@/types/product";

function quantitiesMatch(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.0001;
}

function countLabel(value: number | null): string {
  return value === null ? "Unknown" : value.toLocaleString();
}

function feedbackClassName(feedback: ProductionFeedback): string {
  if (feedback.tone === "success") {
    return "border-green-200 bg-green-50 text-green-800";
  }
  if (feedback.tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (feedback.tone === "info") {
    return "border-blue-200 bg-blue-50 text-blue-800";
  }
  return "border-red-200 bg-red-50 text-red-800";
}

function formatQuantity(value: number, unit = ""): string {
  const formatted = new Intl.NumberFormat("en-AE", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(value);

  return unit ? `${formatted} ${unit}` : formatted;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", {
    currency: "AED",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function PreviewLinesTable({
  lines,
  title,
}: {
  lines: ProductionPreviewLineItem[];
  title: string;
}): JSX.Element | null {
  if (lines.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-neutral-300 bg-white">
      <div className="border-b border-neutral-200 px-3 py-2">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">{title}</p>
      </div>
      <div className="divide-y divide-neutral-200">
        {lines.map((line) => (
          <div
            className="grid gap-2 px-3 py-2 text-xs text-neutral-600 sm:grid-cols-[1.5fr_1fr_1fr_1fr]"
            key={line.recipeLineId}
          >
            <div>
              <p className="font-semibold text-neutral-950">{line.productName}</p>
              <p>{line.productType || "Component"}</p>
            </div>
            <div>
              <p className="text-neutral-500">Required</p>
              <p className="font-semibold text-neutral-950">
                {formatQuantity(line.requiredQuantity, line.unit)}
              </p>
            </div>
            <div>
              <p className="text-neutral-500">Available</p>
              <p
                className={
                  line.shortageQuantity > 0
                    ? "font-semibold text-red-700"
                    : "font-semibold text-neutral-950"
                }
              >
                {formatQuantity(line.availableQuantity, line.unit)}
              </p>
            </div>
            <div>
              <p className="text-neutral-500">Cost</p>
              <p className="font-semibold text-neutral-950">
                {formatMoney(line.estimatedTotalCost)}
              </p>
              {line.shortageQuantity > 0 ? (
                <p className="mt-1 font-semibold text-red-700">
                  Short {formatQuantity(line.shortageQuantity, line.unit)}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BatchFormDialog({
  batch,
  branches,
  canProducePlanned,
  isSubmitting,
  onClose,
  onCreatePlanned,
  onProducePlanned,
  onProduceNow,
  onUpdate,
  open,
  products,
}: {
  batch: ProductionBatch | null;
  branches: ManufacturingBranchOption[];
  canProducePlanned: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onCreatePlanned: (payload: CreateBatchPayload) => Promise<void>;
  onProducePlanned: (id: string, producePayload: ProducePayload) => Promise<void>;
  onProduceNow: (payload: CreateProductionPayload) => Promise<void>;
  onUpdate: (id: string, payload: UpdateBatchPayload) => Promise<void>;
  open: boolean;
  products: ManufacturingProductOption[];
}): JSX.Element {
  const branchScope = useBranchScope();
  const [branchId, setBranchId] = useState("");
  const [productId, setProductId] = useState("");
  const [recipeId, setRecipeId] = useState("");
  const [plannedQuantity, setPlannedQuantity] = useState(1);
  const [productionDate, setProductionDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState<ProductionFeedback | null>(null);
  const selectableBranches = branches.filter(
    (branch) =>
      branch.id === batch?.branchId ||
      (branchScope.canAccessAllBranches
        ? branch.status === "active"
        : branch.id === branchScope.effectiveBranchId),
  );

  useEffect(() => {
    if (!open) return;

    setBranchId(batch?.branchId ?? branchScope.effectiveBranchId ?? "");
    setProductId(batch?.productId ?? "");
    setRecipeId(batch?.recipeId ?? "");
    setPlannedQuantity(batch?.plannedQuantity ?? 1);
    setProductionDate(
      batch?.productionDate?.slice(0, 10) ??
        batch?.startTime?.slice(0, 10) ??
        new Date().toISOString().slice(0, 10),
    );
    setNotes(batch?.notes ?? "");
    setFeedback(null);

  }, [batch, branchScope.effectiveBranchId, open]);

  const clearFeedback = (): void => {
    setFeedback(null);
  };

  const showFeedback = (nextFeedback: ProductionFeedback, notify = true): void => {
    setFeedback(nextFeedback);

    if (!notify) {
      return;
    }

    if (nextFeedback.tone === "success") {
      toast.success(nextFeedback.message);
      return;
    }

    if (nextFeedback.tone === "warning") {
      toast.warning(nextFeedback.message);
      return;
    }

    toast.error(nextFeedback.message);
  };

  const showError = (message: string, title = "Production needs attention"): void => {
    showFeedback({
      message,
      title,
      tone: "error",
    });
  };

  const handleProductChange = (nextProductId: string): void => {
    const normalizedProductId = nextProductId === "none" ? "" : nextProductId;
    clearFeedback();
    setProductId(normalizedProductId);
    setRecipeId("");
  };

  const recipeIsKnownInactive = (recipe: ManufacturingRecipeOption | undefined): boolean =>
    recipe !== undefined &&
    (recipe.isActive === false || (recipe.status !== null && recipe.status !== "active"));

  const recipeHasKnownMissingComponents = (
    recipe: ManufacturingRecipeOption | undefined,
  ): boolean => recipeHasKnownEmptyBom(recipe);

  const recipesQuery = useManufacturingRecipeByProduct(
    { branchId, productId },
    open && branchId.trim().length > 0 && productId.trim().length > 0,
  );
  const recipes = recipesQuery.data ?? [];
  const selectedRecipe = recipes.find((recipe) => recipe.id === recipeId);
  const selectedRecipeIsKnownInactive = recipeIsKnownInactive(selectedRecipe);
  const selectedRecipeHasKnownMissingComponents = recipeHasKnownMissingComponents(selectedRecipe);
  const productionPreviewQuery = useProductionPreview(
    {
      branchId,
      quantity: plannedQuantity,
      recipeId,
    },
    open &&
      !selectedRecipeIsKnownInactive &&
      branchId.trim().length > 0 &&
      recipeId.trim().length > 0 &&
      plannedQuantity > 0,
  );
  const productionPreview = productionPreviewQuery.data;
  const previewHasNoComponentLines = productionPreview?.components.length === 0;
  const previewHadComponentLines = productionPreview !== undefined && !previewHasNoComponentLines;
  const previewMatchesForm =
    productionPreview?.recipeId === recipeId &&
    quantitiesMatch(productionPreview.quantityProduced, plannedQuantity);
  const shouldShowPreviewPanel =
    selectedRecipe !== undefined ||
    productionPreview !== undefined ||
    productionPreviewQuery.isLoading ||
    productionPreviewQuery.isError;

  const validateFreshPreview = async (): Promise<boolean> => {
    const previewResult = await productionPreviewQuery.refetch();

    if (!previewResult.data) {
      showError(
        previewResult.error
          ? productionFailureMessage(previewResult.error)
          : PREVIEW_REQUIRED_MESSAGE,
      );
      return false;
    }

    if (
      previewResult.data.recipeId !== recipeId ||
      !quantitiesMatch(previewResult.data.quantityProduced, plannedQuantity)
    ) {
      showError(PREVIEW_OUT_OF_SYNC_MESSAGE);
      return false;
    }

    const latestPreviewHasNoComponentLines = previewResult.data.components.length === 0;

    if (latestPreviewHasNoComponentLines) {
      showError(EMPTY_BOM_PRODUCTION_MESSAGE);
      return false;
    }

    if (previewResult.data.hasShortage) {
      showError(
        "Production cannot be posted because required component or packaging stock is not available.",
      );
      return false;
    }

    if (previewResult.data.hasZeroCostWarning) {
      showError(
        previewResult.data.warnings[0] ??
          "Production cannot be posted until the recipe has valued component or packaging stock.",
      );
      return false;
    }

    return true;
  };

  const submitPlanned = async (): Promise<void> => {
    const result = createBatchSchema.safeParse({
      branchId,
      notes,
      plannedQuantity,
      productId,
      productionDate,
      recipeId,
    });

    if (!result.success) {
      showError(result.error.issues[0]?.message ?? "Please check the production form.");
      return;
    }

    const selectedRecipe = recipes.find((recipe) => recipe.id === recipeId);

    if (recipeIsKnownInactive(selectedRecipe)) {
      showError("Only an active recipe can be used to create production.");
      return;
    }

    if (batch) {
      await onUpdate(batch.id, {
        notes: result.data.notes,
        productionDate: result.data.productionDate,
      });
      return;
    }

    await onCreatePlanned(result.data);
  };

  const submitProduction = async (): Promise<void> => {
    if (isSubmitting) {
      return;
    }

    const selectedRecipe = recipes.find((recipe) => recipe.id === recipeId);

    const result = createProductionSchema.safeParse({
      branchId,
      notes,
      productId,
      productVariantId: selectedRecipe?.productVariantId ?? null,
      productionDate,
      quantityProduced: plannedQuantity,
      recipeId,
    });

    if (!result.success) {
      showError(result.error.issues[0]?.message ?? "Please check the production form.");
      return;
    }

    if (recipeIsKnownInactive(selectedRecipe)) {
      showError("Only an active recipe can be used to create production.");
      return;
    }

    if (recipeHasKnownMissingComponents(selectedRecipe)) {
      showError(EMPTY_BOM_PRODUCTION_MESSAGE);
      return;
    }

    if (productionPreviewQuery.isLoading || productionPreviewQuery.isFetching) {
      showError("Production preview is still checking stock availability. Try again in a moment.");
      return;
    }

    if (productionPreviewQuery.isError) {
      showError(productionFailureMessage(productionPreviewQuery.error));
      return;
    }

    if (!previewMatchesForm) {
      showError(productionPreview ? PREVIEW_OUT_OF_SYNC_MESSAGE : PREVIEW_REQUIRED_MESSAGE);
      return;
    }

    if (!(await validateFreshPreview())) {
      return;
    }

    try {
      await onProduceNow(result.data);
    } catch (error) {
      showError(
        productionFailureMessage(error, {
          previewHadConsumableLines: previewHadComponentLines,
        }),
        "Production failed",
      );
    }
  };

  const submitPlannedProduction = async (): Promise<void> => {
    if (isSubmitting) {
      return;
    }

    if (!batch) {
      return;
    }

    const selectedRecipe = recipes.find((recipe) => recipe.id === recipeId);

    const productionResult = createBatchSchema.safeParse({
      branchId,
      notes,
      plannedQuantity,
      productId,
      productionDate,
      recipeId,
    });
    const produceResult = produceSchema.safeParse({ quantityProduced: plannedQuantity });

    if (!productionResult.success) {
      showError(productionResult.error.issues[0]?.message ?? "Please check the production form.");
      return;
    }

    if (!produceResult.success) {
      showError(produceResult.error.issues[0]?.message ?? "Please check produced quantity.");
      return;
    }

    if (recipeIsKnownInactive(selectedRecipe)) {
      showError("Only an active recipe can be used to create production.");
      return;
    }

    if (recipeHasKnownMissingComponents(selectedRecipe)) {
      showError(EMPTY_BOM_PRODUCTION_MESSAGE);
      return;
    }

    if (productionPreviewQuery.isLoading || productionPreviewQuery.isFetching) {
      showError("Production preview is still checking stock availability. Try again in a moment.");
      return;
    }

    if (productionPreviewQuery.isError) {
      showError(productionFailureMessage(productionPreviewQuery.error));
      return;
    }

    if (!previewMatchesForm) {
      showError(productionPreview ? PREVIEW_OUT_OF_SYNC_MESSAGE : PREVIEW_REQUIRED_MESSAGE);
      return;
    }

    if (!(await validateFreshPreview())) {
      return;
    }

    try {
      await onProducePlanned(batch.id, {
        notes: productionResult.data.notes,
        productionDate: productionResult.data.productionDate,
        quantityProduced: produceResult.data.quantityProduced,
      });
    } catch (error) {
      showError(
        productionFailureMessage(error, {
          previewHadConsumableLines: previewHadComponentLines,
        }),
        "Production failed",
      );
    }
  };
  const isCreateDisabled = isSubmitting || selectedRecipeIsKnownInactive;
  const isProduceDisabled = isSubmitting;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => (!nextOpen && !isSubmitting ? onClose() : undefined)}
    >
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-neutral-300 px-8 py-6">
          <DialogTitle>{batch ? "Edit planned production" : "Create production"}</DialogTitle>
          <DialogDescription>
            Save a planned production without stock impact, or produce now to let the backend
            consume components, create stock, and post accounting in one transaction.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-950">Branch</label>
              {batch ? (
                <div className="min-h-10 rounded-md border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950">
                  {batch.branchName}
                </div>
              ) : (
                <Select
                  value={branchId || "none"}
                  onValueChange={(value) => {
                    clearFeedback();
                    setBranchId(value === "none" ? "" : value);
                    setRecipeId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select branch</SelectItem>
                    {selectableBranches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.branchName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-950">Production date</label>
              <Input
                aria-label="Production date"
                onChange={(event) => {
                  clearFeedback();
                  setProductionDate(event.target.value);
                }}
                type="date"
                value={productionDate}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-neutral-950">Output product</label>
              {batch ? (
                <div className="min-h-10 rounded-md border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950">
                  {batch.productVariantName
                    ? `${batch.productName} / ${batch.productVariantName}`
                    : batch.productName}
                </div>
              ) : (
                <Select value={productId || "none"} onValueChange={handleProductChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Product" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select product</SelectItem>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.productName} / {PRODUCT_TYPE_LABELS[product.productType]} /{" "}
                        {ITEM_STRUCTURE_LABELS[product.itemStructure]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-neutral-950">Active recipe</label>
              {batch ? (
                <div className="min-h-10 rounded-md border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-950">
                  {batch.recipeName}{" "}
                  {batch.recipeVersionNumber ? <>v{batch.recipeVersionNumber}</> : null}
                </div>
              ) : (
                <Select
                  value={recipeId || "none"}
                  onValueChange={(value) => {
                    clearFeedback();
                    setRecipeId(value === "none" ? "" : value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Recipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select recipe</SelectItem>
                    {recipesQuery.isLoading || recipesQuery.isFetching ? (
                      <SelectItem disabled value="loading">
                        Loading recipes...
                      </SelectItem>
                    ) : null}
                    {recipes.map((recipe) => (
                      <SelectItem key={recipe.id} value={recipe.id}>
                        {recipe.recipeName} v{recipe.versionNumber}
                        {recipe.productVariantName ? ` / ${recipe.productVariantName}` : ""}
                        {recipe.isActive === false ||
                        (recipe.status !== null && recipe.status !== "active")
                          ? " (inactive)"
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {shouldShowPreviewPanel ? (
              <div className="rounded-2xl border border-neutral-300 bg-neutral-100 p-5 text-sm text-neutral-600 md:col-span-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-neutral-950">Recipe Details</p>
                    <p className="mt-3">
                      Output stock:{" "}
                      <span className="font-semibold text-neutral-950">
                        {selectedRecipe?.productVariantName ??
                          batch?.productVariantName ??
                          "Parent product"}
                      </span>
                    </p>
                    <p>
                      Recipe yield:{" "}
                      {selectedRecipe
                        ? formatQuantity(
                            selectedRecipe.batchYieldQuantity,
                            selectedRecipe.batchYieldUnitName,
                          )
                        : `Current batch uses ${batch?.batchUnitName ?? "the saved yield unit"}`}
                    </p>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <div className="rounded-xl border border-neutral-300 bg-white px-3 py-2">
                        <span className="text-neutral-500">Ingredients</span>
                        <strong className="ml-2 text-neutral-950">
                          {productionPreview
                            ? productionPreview.components.length.toLocaleString()
                            : countLabel(selectedRecipe?.componentCount ?? null)}
                        </strong>
                      </div>
                      <div className="rounded-xl border border-neutral-300 bg-white px-3 py-2">
                        <span className="text-neutral-500">Packaging</span>
                        <strong className="ml-2 text-neutral-950">
                          {productionPreview
                            ? productionPreview.packaging.length.toLocaleString()
                            : countLabel(selectedRecipe?.packagingCount ?? null)}
                        </strong>
                      </div>
                    </div>
                  </div>
                  {(selectedRecipe?.versionNumber ?? batch?.recipeVersionNumber) ? (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-neutral-600">
                      v{selectedRecipe?.versionNumber ?? batch?.recipeVersionNumber}
                    </span>
                  ) : null}
                </div>
                {selectedRecipeIsKnownInactive ? (
                  <p className="mt-3 font-semibold text-red-700">
                    Activate this recipe before creating production.
                  </p>
                ) : null}
                {selectedRecipeHasKnownMissingComponents ? (
                  <Alert className="mt-4 border-amber-300 bg-amber-50 text-amber-950">
                    <AlertTitle>Missing BOM lines</AlertTitle>
                    <AlertDescription>{EMPTY_BOM_PRODUCTION_MESSAGE}</AlertDescription>
                  </Alert>
                ) : null}
                {productionPreviewQuery.isLoading ? (
                  <Alert className="mt-4 border-neutral-300 bg-white text-neutral-700">
                    <AlertTitle>Checking stock availability</AlertTitle>
                    <AlertDescription>
                      Required components, packaging, and cost will appear here before production
                      can be posted.
                    </AlertDescription>
                  </Alert>
                ) : null}
                {productionPreviewQuery.isError ? (
                  <Alert className="mt-4 border-red-300 bg-red-50 text-red-950">
                    <AlertTitle>Cannot validate production stock</AlertTitle>
                    <AlertDescription>
                      {productionFailureMessage(productionPreviewQuery.error)}
                    </AlertDescription>
                  </Alert>
                ) : null}
                {productionPreview ? (
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm sm:grid-cols-3">
                      <div>
                        <p className="text-neutral-500">Estimated total cost</p>
                        <p className="font-semibold text-neutral-950">
                          {formatMoney(productionPreview.estimatedTotalCost)}
                        </p>
                      </div>
                      <div>
                        <p className="text-neutral-500">Cost per unit</p>
                        <p className="font-semibold text-neutral-950">
                          {formatMoney(productionPreview.estimatedCostPerUnit)}
                        </p>
                      </div>
                      <div>
                        <p className="text-neutral-500">Quantity checked</p>
                        <p className="font-semibold text-neutral-950">
                          {formatQuantity(
                            productionPreview.quantityProduced,
                            productionPreview.recipeYieldUnit,
                          )}
                        </p>
                      </div>
                    </div>

                    <PreviewLinesTable lines={productionPreview.components} title="Components" />
                    <PreviewLinesTable lines={productionPreview.packaging} title="Packaging" />

                    {previewHasNoComponentLines ? (
                      <Alert className="border-amber-300 bg-amber-50 text-amber-950">
                        <AlertTitle>Missing BOM lines</AlertTitle>
                        <AlertDescription>{EMPTY_BOM_PRODUCTION_MESSAGE}</AlertDescription>
                      </Alert>
                    ) : null}

                    {productionPreview.hasShortage ? (
                      <Alert className="border-red-300 bg-red-50 text-red-950">
                        <AlertTitle>Not enough stock to produce</AlertTitle>
                        <AlertDescription>
                          Add stock for the shortage items before posting production.
                          <ul className="mt-2 list-disc space-y-1 pl-5">
                            {productionPreview.shortages.map((shortage) => (
                              <li key={shortage.recipeLineId}>
                                {shortage.productName}: short{" "}
                                {formatQuantity(shortage.shortageQuantity, shortage.unit)}
                              </li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    ) : null}

                    {productionPreview.warnings.length > 0 ? (
                      <Alert className="border-amber-300 bg-amber-50 text-amber-950">
                        <AlertTitle>Production cost warning</AlertTitle>
                        <AlertDescription>
                          <ul className="list-disc space-y-1 pl-5">
                            {productionPreview.warnings.map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-950">
                {batch ? "Quantity to produce now" : "Quantity to produce"}
              </label>
              <Input
                aria-label="Quantity to produce"
                min="0"
                onChange={(event) => {
                  clearFeedback();
                  setPlannedQuantity(Number(event.target.value));
                }}
                placeholder="Quantity to produce"
                type="number"
                value={plannedQuantity}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-950">Notes</label>
              <Input
                aria-label="Notes"
                onChange={(event) => {
                  clearFeedback();
                  setNotes(event.target.value);
                }}
                placeholder="Optional production notes..."
                value={notes}
              />
            </div>
          </div>
        </div>

        {feedback ? (
          <div className="shrink-0 px-8 pb-4">
            <Alert className={feedbackClassName(feedback)}>
              <AlertTitle>{feedback.title}</AlertTitle>
              <AlertDescription>{feedback.message}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        <DialogFooter className="shrink-0 border-t border-neutral-300 bg-neutral-50 px-8 py-5">
          <Button disabled={isSubmitting} onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          {!batch ? (
            <Button
              disabled={isCreateDisabled}
              onClick={() => void submitPlanned()}
              type="button"
              variant="outline"
            >
              Save as Planned
            </Button>
          ) : (
            <Button
              disabled={isCreateDisabled}
              onClick={() => void submitPlanned()}
              type="button"
              variant="outline"
            >
              Save date and notes
            </Button>
          )}
          {batch && canProducePlanned ? (
            <Button
              className="bg-black text-white hover:bg-neutral-800"
              disabled={isProduceDisabled}
              onClick={() => void submitPlannedProduction()}
              type="button"
            >
              {isSubmitting ? "Producing..." : "Produce planned"}
            </Button>
          ) : null}
          {!batch ? (
            <Button
              className="bg-black text-white hover:bg-neutral-800"
              disabled={isProduceDisabled}
              onClick={() => void submitProduction()}
              type="button"
            >
              Produce now
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
