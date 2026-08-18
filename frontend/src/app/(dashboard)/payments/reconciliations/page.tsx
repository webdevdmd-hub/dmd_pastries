import { redirect } from "next/navigation";

// Moved into a tab on /payments — see refunds/page.tsx.
export default function PaymentReconciliationsRedirectPage(): never {
  redirect("/payments?tab=reconciliation");
}
