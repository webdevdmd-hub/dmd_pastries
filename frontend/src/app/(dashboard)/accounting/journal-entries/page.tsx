import type { Metadata } from "next";
import type { JSX } from "react";

import { JournalEntriesPageClient } from "@/components/accounting/journal-entries-page-client";

export const metadata: Metadata = {
  title: "Journal Entries",
};

export default function JournalEntriesPage(): JSX.Element {
  return <JournalEntriesPageClient />;
}
