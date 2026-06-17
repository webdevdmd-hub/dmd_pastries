"use client";

import type { JSX } from "react";
import { useEffect, useState } from "react";

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
import { createBatchSchema, createProductionSchema } from "@/lib/validators/manufacturing.schema";
import type {
  CreateBatchPayload,
  CreateProductionPayload,
  ManufacturingBranchOption,
  ManufacturingProductOption,
  ManufacturingRecipeOption,
  ProducePayload,
  ProductionBatch,
  UpdateBatchPayload,
} from "@/types/manufacturing";
import { ITEM_STRUCTURE_LABELS, PRODUCT_TYPE_LABELS } from "@/types/product";

export function BatchFormDialog({
  batch,
  branches,
  canProducePlanned,
  isSubmitting,
  onClose,
  onCreatePlanned,
  onProductChange,
  onProducePlanned,
  onProduceNow,
  onUpdate,
  open,
  products,
  recipes,
}: {
  batch: ProductionBatch | null;
  branches: ManufacturingBranchOption[];
  canProducePlanned: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onCreatePlanned: (payload: CreateBatchPayload) => Promise<void>;
  onProductChange: (productId: string) => void;
  onProducePlanned: (
    id: string,
    updatePayload: UpdateBatchPayload,
    producePayload: ProducePayload,
  ) => Promise<void>;
  onProduceNow: (payload: CreateProductionPayload) => Promise<void>;
  onUpdate: (id: string, payload: UpdateBatchPayload) => Promise<void>;
  open: boolean;
  products: ManufacturingProductOption[];
  recipes: ManufacturingRecipeOption[];
}): JSX.Element {
  const branchScope = useBranchScope();
  const [branchId, setBranchId] = useState("");
  const [productId, setProductId] = useState("");
  const [recipeId, setRecipeId] = useState("");
  const [plannedQuantity, setPlannedQuantity] = useState(1);
  const [productionDate, setProductionDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
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
    setError(null);

    if (batch?.productId) {
      onProductChange(batch.productId);
    }
  }, [batch, branchScope.effectiveBranchId, onProductChange, open]);

  const handleProductChange = (nextProductId: string): void => {
    const normalizedProductId = nextProductId === "none" ? "" : nextProductId;
    setProductId(normalizedProductId);
    setRecipeId("");
    if (normalizedProductId) {
      onProductChange(normalizedProductId);
    }
  };

  const recipeIsKnownInactive = (recipe: ManufacturingRecipeOption | undefined): boolean =>
    recipe !== undefined &&
    (recipe.isActive === false || (recipe.status !== null && recipe.status !== "active"));

  const recipeHasKnownEmptyBom = (recipe: ManufacturingRecipeOption | undefined): boolean =>
    recipe?.componentCount === 0 && recipe.packagingCount === 0;

  const submitPlanned = async (): Promise<void> => {
    const selectedRecipe = recipes.find((recipe) => recipe.id === recipeId);

    if (recipeIsKnownInactive(selectedRecipe)) {
      setError("Only an active recipe can be used to create production.");
      return;
    }

    const result = createBatchSchema.safeParse({
      branchId,
      notes,
      plannedQuantity,
      productId,
      productionDate,
      recipeId,
    });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Please check the production form.");
      return;
    }

    if (batch) {
      await onUpdate(batch.id, result.data);
      return;
    }

    await onCreatePlanned(result.data);
  };

  const submitProduction = async (): Promise<void> => {
    const selectedRecipe = recipes.find((recipe) => recipe.id === recipeId);

    if (recipeIsKnownInactive(selectedRecipe)) {
      setError("Only an active recipe can be used to create production.");
      return;
    }

    if (recipeHasKnownEmptyBom(selectedRecipe)) {
      setError("This recipe has no ingredients or packaging. Add BOM lines before producing.");
      return;
    }

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
      setError(result.error.issues[0]?.message ?? "Please check the production form.");
      return;
    }

    await onProduceNow(result.data);
  };

  const submitPlannedProduction = async (): Promise<void> => {
    if (!batch) {
      return;
    }

    const selectedRecipe = recipes.find((recipe) => recipe.id === recipeId);

    if (recipeIsKnownInactive(selectedRecipe)) {
      setError("Only an active recipe can be used to create production.");
      return;
    }

    if (recipeHasKnownEmptyBom(selectedRecipe)) {
      setError("This recipe has no ingredients or packaging. Add BOM lines before producing.");
      return;
    }

    const result = createBatchSchema.safeParse({
      branchId,
      notes,
      plannedQuantity,
      productId,
      productionDate,
      recipeId,
    });

    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Please check the production form.");
      return;
    }

    await onProducePlanned(batch.id, result.data, {
      productionDate: result.data.productionDate,
      quantityProduced: result.data.plannedQuantity,
    });
  };

  const selectedRecipe = recipes.find((recipe) => recipe.id === recipeId);
  const selectedRecipeIsKnownInactive = recipeIsKnownInactive(selectedRecipe);
  const selectedRecipeHasKnownEmptyBom = recipeHasKnownEmptyBom(selectedRecipe);
  const isCreateDisabled = isSubmitting || selectedRecipeIsKnownInactive;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b border-neutral-300 px-8 py-6">
          <DialogTitle>{batch ? "Edit planned production" : "Create production"}</DialogTitle>
          <DialogDescription>
            Save a planned production without stock impact, or produce now to let the backend
            consume components, create stock, and post accounting in one transaction.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(92vh-11rem)] overflow-y-auto px-8 py-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-950">Branch</label>
              <Select
                value={branchId || "none"}
                onValueChange={(value) => setBranchId(value === "none" ? "" : value)}
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
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-950">Production date</label>
              <Input
                aria-label="Production date"
                onChange={(event) => setProductionDate(event.target.value)}
                type="date"
                value={productionDate}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-neutral-950">Output product</label>
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
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-neutral-950">Active recipe</label>
              <Select
                value={recipeId || "none"}
                onValueChange={(value) => setRecipeId(value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Recipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select recipe</SelectItem>
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
            </div>

            {selectedRecipe ? (
              <div className="rounded-2xl border border-neutral-300 bg-neutral-100 p-5 text-sm text-neutral-600 md:col-span-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-neutral-950">Recipe Details</p>
                    <p className="mt-3">
                      Output stock:{" "}
                      <span className="font-semibold text-neutral-950">
                        {selectedRecipe.productVariantName ?? "Parent product"}
                      </span>
                    </p>
                    <p>
                      Recipe yield: {selectedRecipe.batchYieldQuantity}{" "}
                      {selectedRecipe.batchYieldUnitName}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-neutral-600">
                    v{selectedRecipe.versionNumber}
                  </span>
                </div>
                {selectedRecipeIsKnownInactive ? (
                  <p className="mt-3 font-semibold text-red-700">
                    Activate this recipe before creating production.
                  </p>
                ) : null}
                {selectedRecipeHasKnownEmptyBom ? (
                  <Alert className="mt-4 border-amber-300 bg-amber-50 text-amber-950">
                    <AlertTitle>Missing BOM lines</AlertTitle>
                    <AlertDescription>
                      This recipe has no ingredients or packaging. Add BOM lines before producing.
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-950">Quantity to produce</label>
              <Input
                aria-label="Quantity to produce"
                min="0"
                onChange={(event) => setPlannedQuantity(Number(event.target.value))}
                placeholder="Quantity to produce"
                type="number"
                value={plannedQuantity}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-950">Notes</label>
              <Input
                aria-label="Notes"
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional production notes..."
                value={notes}
              />
            </div>
          </div>
          {error ? <p className="mt-4 text-sm font-semibold text-red-700">{error}</p> : null}
        </div>

        <DialogFooter className="border-t border-neutral-300 bg-neutral-50 px-8 py-5">
          <Button onClick={onClose} type="button" variant="outline">
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
              Save planned production
            </Button>
          )}
          {batch && canProducePlanned ? (
            <Button
              className="bg-black text-white hover:bg-neutral-800"
              disabled={isCreateDisabled}
              onClick={() => void submitPlannedProduction()}
              type="button"
            >
              Produce planned
            </Button>
          ) : null}
          {!batch ? (
            <Button
              className="bg-black text-white hover:bg-neutral-800"
              disabled={isCreateDisabled}
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
