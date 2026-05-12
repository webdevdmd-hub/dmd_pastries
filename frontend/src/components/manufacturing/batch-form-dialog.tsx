"use client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useRecipeIngredients } from "@/hooks/use-recipes";
import { createBatchSchema } from "@/lib/validators/manufacturing.schema";
import type {
  CreateBatchPayload,
  ManufacturingBranchOption,
  ManufacturingProductOption,
  ManufacturingRecipeOption,
  ProductionBatch,
  UpdateBatchPayload,
} from "@/types/manufacturing";

export function BatchFormDialog({
  batch,
  branches,
  isSubmitting,
  onClose,
  onCreate,
  onProductChange,
  onUpdate,
  open,
  products,
  recipes,
}: {
  batch: ProductionBatch | null;
  branches: ManufacturingBranchOption[];
  isSubmitting: boolean;
  onClose: () => void;
  onCreate: (payload: CreateBatchPayload) => Promise<void>;
  onProductChange: (productId: string) => void;
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
  const recipeIngredientsQuery = useRecipeIngredients(
    recipeId.length > 0 ? recipeId : null,
    open && recipeId.length > 0,
  );

  useEffect(() => {
    if (!open) return;

    setBranchId(batch?.branchId ?? branchScope.effectiveBranchId ?? "");
    setProductId(batch?.productId ?? "");
    setRecipeId(batch?.recipeId ?? "");
    setPlannedQuantity(batch?.plannedQuantity ?? 1);
    setProductionDate(new Date().toISOString().slice(0, 10));
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

  const submit = async (): Promise<void> => {
    const selectedRecipe = recipes.find((recipe) => recipe.id === recipeId);
    const recipeIsKnownInactive =
      selectedRecipe !== undefined &&
      (selectedRecipe.isActive === false ||
        (selectedRecipe.status !== null && selectedRecipe.status !== "active"));

    if (recipeIsKnownInactive) {
      setError("Only an active recipe can be used to create a production batch.");
      return;
    }

    if (recipeIngredientsQuery.isLoading || recipeIngredientsQuery.isFetching) {
      setError("Recipe BOM is still loading. Please wait a moment.");
      return;
    }

    if (recipeIngredientsQuery.data?.length === 0) {
      setError("Add at least one ingredient line to this recipe before creating a batch.");
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
      setError(result.error.issues[0]?.message ?? "Please check the batch form.");
      return;
    }

    if (batch) {
      await onUpdate(batch.id, result.data);
    } else {
      await onCreate(result.data);
    }
  };

  const selectedRecipe = recipes.find((recipe) => recipe.id === recipeId);
  const selectedRecipeIsKnownInactive =
    selectedRecipe !== undefined &&
    (selectedRecipe.isActive === false ||
      (selectedRecipe.status !== null && selectedRecipe.status !== "active"));
  const selectedRecipeHasNoIngredients = recipeIngredientsQuery.data?.length === 0;
  const isCreateDisabled =
    isSubmitting ||
    recipeIngredientsQuery.isLoading ||
    recipeIngredientsQuery.isFetching ||
    selectedRecipeIsKnownInactive ||
    selectedRecipeHasNoIngredients;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{batch ? "Edit production batch" : "Create production batch"}</DialogTitle>
          <DialogDescription>
            Choose a branch, product, active recipe, and planned production quantity.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
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
          <Select value={productId || "none"} onValueChange={handleProductChange}>
            <SelectTrigger>
              <SelectValue placeholder="Product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Select product</SelectItem>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.productName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                  {recipe.isActive === false ||
                  (recipe.status !== null && recipe.status !== "active")
                    ? " (inactive)"
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            aria-label="Planned quantity"
            min="0"
            onChange={(event) => setPlannedQuantity(Number(event.target.value))}
            placeholder="Planned quantity"
            type="number"
            value={plannedQuantity}
          />
          <Input
            aria-label="Production date"
            onChange={(event) => setProductionDate(event.target.value)}
            type="date"
            value={productionDate}
          />
        </div>
        {selectedRecipe ? (
          <div className="rounded-2xl border border-brand-cappuccino/70 bg-brand-latte/60 p-4 text-sm text-brand-mocha">
            <p>
              Recipe yield: {selectedRecipe.batchYieldQuantity} {selectedRecipe.batchYieldUnitName}
            </p>
            {recipeIngredientsQuery.isLoading || recipeIngredientsQuery.isFetching ? (
              <p className="mt-2 font-semibold">Checking recipe BOM...</p>
            ) : null}
            {selectedRecipeIsKnownInactive ? (
              <p className="mt-2 font-semibold text-red-700">
                Activate this recipe before creating a production batch.
              </p>
            ) : null}
            {selectedRecipeHasNoIngredients ? (
              <p className="mt-2 font-semibold text-red-700">
                This recipe has no ingredient BOM lines. Add ingredients in Recipes first.
              </p>
            ) : null}
          </div>
        ) : null}
        <Input
          aria-label="Notes"
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Notes"
          value={notes}
        />
        {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={isCreateDisabled} onClick={() => void submit()} type="button">
            {batch ? "Save batch" : "Create batch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
