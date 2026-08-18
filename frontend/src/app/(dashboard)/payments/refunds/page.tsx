import { redirect } from "next/navigation";

// Moved into a tab on /payments (Phase 2 of the payments redesign). The route
// stays as a redirect so existing bookmarks, deep links and anything a person
// pasted into a message still land on the right surface.
export default function PaymentRefundsRedirectPage(): never {
  redirect("/payments?tab=refunds");
}
