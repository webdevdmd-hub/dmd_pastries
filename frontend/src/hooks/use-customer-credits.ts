import { useQuery } from "@tanstack/react-query";

import { type CustomerCreditsResponse, getCustomerCredits } from "@/lib/api/customer-credits";

// Store-credit balance + history for one customer (Phase 4 / W4). Consumed
// by the POS customer chip (tender gating) and the customer details page.
export function useCustomerCredits(customerId: string | null, enabled = true) {
  return useQuery<CustomerCreditsResponse>({
    enabled: enabled && customerId !== null && customerId.length > 0,
    queryFn: async () => getCustomerCredits(customerId ?? ""),
    queryKey: ["customer-credits", customerId],
  });
}
