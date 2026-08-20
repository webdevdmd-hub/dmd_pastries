"use client";

import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
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
    return "border-money/30 bg-money-tint text-money-text";
  }
  if (feedback.tone === "warning") {
    return "border-warning/30 bg-warning-tint text-warning-text";
  }
  if (feedback.tone === "info") {
    return "border-info/30 bg-info-tint text-info-text";
  }
  return "border-danger/30 bg-danger-tint text-danger-text";
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
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-3 py-2">
        <p className="text-xs font-bold text-foreground-muted">{title}</p>
      </div>
      <div className="divide-y divide-border">
        {lines.map((line) => (
          <div
            className="grid gap-2 px-3 py-2 text-xs text-foreground-muted sm:grid-cols-[1.5fr_1fr_1fr_1fr]"
            key={line.recipeLineId}
          >
            <div>
              <p className="font-semibold text-foreground">{line.productName}</p>
              <p>{line.productType || "Component"}</p>
            </div>
            <div>
              <p className="text-foreground-muted">Required</p>
              <p className="font-semibold text-foreground">
                {formatQuantity(line.requiredQuantity, line.unit)}
              </p>
            </div>
            <div>
              <p className="text-foreground-muted">Available</p>
              <p
                className={
                  line.shortageQuantity > 0
                    ? "font-semibold text-danger-text"
                    : "font-semibold text-foreground"
                }
              >
                {formatQuantity(line.availableQuantity, line.unit)}
              </p>
            </div>
            <div>
              <p className="text-foreground-muted">Cost</p>
              <p className="font-semibold text-foreground">
                {formatMoney(line.estimatedTotalCost)}
              </p>
              {line.shortageQuantity > 0 ? (
                <p className="mt-1 font-semibold text-danger-text">
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
  const [isCheckingPreview, setIsCheckingPreview] = useState(false);
  const productionActionInFlightRef = useRef(false);
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
    if (isSubmitting || productionActionInFlightRef.current) {
      return;
    }

    productionActionInFlightRef.current = true;

    try {
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

      setIsCheckingPreview(true);
      const previewIsValid = await validateFreshPreview();
      setIsCheckingPreview(false);

      if (!previewIsValid) {
        return;
      }

      await onProduceNow(result.data);
    } catch (error) {
      showError(
        productionFailureMessage(error, {
          previewHadConsumableLines: previewHadComponentLines,
        }),
        "Production failed",
      );
    } finally {
      productionActionInFlightRef.current = false;
      setIsCheckingPreview(false);
    }
  };

  const submitPlannedProduction = async (): Promise<void> => {
    if (isSubmitting || productionActionInFlightRef.current) {
      return;
    }

    if (!batch) {
      return;
    }

    productionActionInFlightRef.current = true;

    try {
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

      setIsCheckingPreview(true);
      const previewIsValid = await validateFreshPreview();
      setIsCheckingPreview(false);

      if (!previewIsValid) {
        return;
      }

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
    } finally {
      productionActionInFlightRef.current = false;
      setIsCheckingPreview(false);
    }
  };
  const isCreateDisabled = isSubmitting || selectedRecipeIsKnownInactive;
  const isProduceDisabled = isSubmitting || isCheckingPreview;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => (!nextOpen && !isSubmitting ? onClose() : undefined)}
    >
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-8 py-6">
          <DialogTitle>{batch ? "Edit planned production" : "Create production"}</DialogTitle>
          <DialogDescription>
            Save a planned production without stock impact, or produce now to let the backend
            consume components, create stock, and post accounting in one transaction.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="batch-form-branch" className="text-sm font-medium text-foreground">
                Branch
              </label>
              {batch ? (
                <div className="min-h-10 rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground">
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
                  <SelectTrigger id="batch-form-branch">
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
              <label
                htmlFor="batch-form-production-date"
                className="text-sm font-medium text-foreground"
              >
                Production date
              </label>
              <Input
                id="batch-form-production-date"
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
              <label
                htmlFor="batch-form-output-product"
                className="text-sm font-medium text-foreground"
              >
                Output product
              </label>
              {batch ? (
                <div className="min-h-10 rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground">
                  {batch.productVariantName
                    ? `${batch.productName} / ${batch.productVariantName}`
                    : batch.productName}
                </div>
              ) : (
                <Select value={productId || "none"} onValueChange={handleProductChange}>
                  <SelectTrigger id="batch-form-output-product">
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
              <label
                htmlFor="batch-form-active-recipe"
                className="text-sm font-medium text-foreground"
              >
                Active recipe
              </label>
              {batch ? (
                <div className="min-h-10 rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground">
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
                  <SelectTrigger id="batch-form-active-recipe">
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
              <div className="rounded-2xl border border-border bg-muted p-5 text-sm text-foreground-muted md:col-span-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-foreground">Recipe Details</p>
                    <p className="mt-3">
                      Output stock:{" "}
                      <span className="font-semibold text-foreground">
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
                      <div className="rounded-xl border border-border bg-card px-3 py-2">
                        <span className="text-foreground-muted">Ingredients</span>
                        <strong className="ml-2 text-foreground">
                          {productionPreview
                            ? productionPreview.components.length.toLocaleString()
                            : countLabel(selectedRecipe?.componentCount ?? null)}
                        </strong>
                      </div>
                      <div className="rounded-xl border border-border bg-card px-3 py-2">
                        <span className="text-foreground-muted">Packaging</span>
                        <strong className="ml-2 text-foreground">
                          {productionPreview
                            ? productionPreview.packaging.length.toLocaleString()
                            : countLabel(selectedRecipe?.packagingCount ?? null)}
                        </strong>
                      </div>
                    </div>
                  </div>
                  {(selectedRecipe?.versionNumber ?? batch?.recipeVersionNumber) ? (
                    <span className="rounded-full bg-card px-3 py-1 text-xs font-bold text-foreground-muted">
                      v{selectedRecipe?.versionNumber ?? batch?.recipeVersionNumber}
                    </span>
                  ) : null}
                </div>
                {selectedRecipeIsKnownInactive ? (
                  <p className="mt-3 font-semibold text-danger-text">
                    Activate this recipe before creating production.
                  </p>
                ) : null}
                {selectedRecipeHasKnownMissingComponents ? (
                  <Alert className="mt-4 border-warning/30 bg-warning-tint text-warning-text">
                    <AlertTitle>Missing BOM lines</AlertTitle>
                    <AlertDescription>{EMPTY_BOM_PRODUCTION_MESSAGE}</AlertDescription>
                  </Alert>
                ) : null}
                {productionPreviewQuery.isLoading ? (
                  <Alert className="mt-4 border-border bg-card text-foreground-muted">
                    <AlertTitle>Checking stock availability</AlertTitle>
                    <AlertDescription>
                      Required components, packaging, and cost will appear here before production
                      can be posted.
                    </AlertDescription>
                  </Alert>
                ) : null}
                {productionPreviewQuery.isError ? (
                  <Alert className="mt-4 border-danger/30 bg-danger-tint text-danger-text">
                    <AlertTitle>Cannot validate production stock</AlertTitle>
                    <AlertDescription>
                      {productionFailureMessage(productionPreviewQuery.error)}
                    </AlertDescription>
                  </Alert>
                ) : null}
                {productionPreview ? (
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm sm:grid-cols-3">
                      <div>
                        <p className="text-foreground-muted">Estimated total cost</p>
                        <p className="font-semibold text-foreground">
                          {formatMoney(productionPreview.estimatedTotalCost)}
                        </p>
                      </div>
                      <div>
                        <p className="text-foreground-muted">Cost per unit</p>
                        <p className="font-semibold text-foreground">
                          {formatMoney(productionPreview.estimatedCostPerUnit)}
                        </p>
                      </div>
                      <div>
                        <p className="text-foreground-muted">Quantity checked</p>
                        <p className="font-semibold text-foreground">
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
                      <Alert className="border-warning/30 bg-warning-tint text-warning-text">
                        <AlertTitle>Missing BOM lines</AlertTitle>
                        <AlertDescription>{EMPTY_BOM_PRODUCTION_MESSAGE}</AlertDescription>
                      </Alert>
                    ) : null}

                    {productionPreview.hasShortage ? (
                      <Alert className="border-danger/30 bg-danger-tint text-danger-text">
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
                      <Alert className="border-warning/30 bg-warning-tint text-warning-text">
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
              <label htmlFor="batch-form-field" className="text-sm font-medium text-foreground">
                {batch ? "Quantity to produce now" : "Quantity to produce"}
              </label>
              <Input
                id="batch-form-field"
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
              <label htmlFor="batch-form-notes" className="text-sm font-medium text-foreground">
                Notes
              </label>
              <Input
                id="batch-form-notes"
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

        <DialogFooter className="shrink-0 border-t border-border bg-muted px-8 py-5">
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
              className="bg-primary text-primary-foreground hover:bg-primary"
              disabled={isProduceDisabled}
              onClick={() => void submitPlannedProduction()}
              type="button"
            >
              {isCheckingPreview
                ? "Checking stock..."
                : isSubmitting
                  ? "Producing..."
                  : "Produce planned"}
            </Button>
          ) : null}
          {!batch ? (
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary"
              disabled={isProduceDisabled}
              onClick={() => void submitProduction()}
              type="button"
            >
              {isCheckingPreview
                ? "Checking stock..."
                : isSubmitting
                  ? "Producing..."
                  : "Produce now"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
