import { ApiError } from "@/lib/api/client";

type DeletableCatalogEntity = "ingredient" | "packaging item" | "product" | "purchase order";

function getReason(error: ApiError): string | null {
  const reason = error.errorDetails?.reason;

  return typeof reason === "string" ? reason : null;
}

export function isHistoryDeleteConflict(error: unknown): error is ApiError {
  if (!(error instanceof ApiError) || error.status !== 409) {
    return false;
  }

  const reason = getReason(error);
  if (reason?.endsWith("_has_history")) {
    return true;
  }

  const normalizedMessage = error.message.toLowerCase();

  return normalizedMessage.includes("history") && normalizedMessage.includes("cannot be deleted");
}

export function getHistoryDeleteConflictMessage(entity: DeletableCatalogEntity): string {
  if (entity === "product") {
    return "This product has stock/sales history and cannot be deleted. Please deactivate or archive it instead.";
  }

  if (entity === "purchase order") {
    return "This purchase order already has receiving, bill, payment, vendor credit, or stock history, so it cannot be hard deleted. Keep it in history or cancel it if the workflow should be stopped.";
  }

  return `This ${entity} has inventory or usage history and cannot be deleted. Please deactivate it instead.`;
}
