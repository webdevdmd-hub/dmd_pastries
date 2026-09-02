"use client";

import type { JSX } from "react";

import { SupplierContactsSection } from "@/components/suppliers/supplier-contacts-section";
import type { SupplierDetailTabKey } from "@/components/suppliers/supplier-detail-tabs";
import {
  SUPPLIER_DETAIL_TABPANEL_ID,
  SupplierDetailViewTabs,
} from "@/components/suppliers/supplier-detail-view-tabs";
import { SupplierDocumentsPanel } from "@/components/suppliers/supplier-documents-panel";
import { SupplierHistoryPanel } from "@/components/suppliers/supplier-history-panel";
import { SupplierNotesSection } from "@/components/suppliers/supplier-notes-section";
import { SupplierProfileCard } from "@/components/suppliers/supplier-profile-card";
import { SupplierStatementPanel } from "@/components/suppliers/supplier-statement-panel";
import { SupplierStatsCards } from "@/components/suppliers/supplier-stats-cards";
import { useSupplierContacts, useSupplierNotes, useSupplierStats } from "@/hooks/use-suppliers";
import type { Supplier } from "@/types/supplier";

type SupplierDetailsPanelProps = {
  activeTab: SupplierDetailTabKey;
  canManage: boolean;
  canView: boolean;
  onTabChange: (tab: SupplierDetailTabKey) => void;
  supplier: Supplier;
};

/**
 * The body of a supplier's details: the tab strip and whichever panel is
 * selected. Shared by the full page and the drawer over the list, which is
 * why the tab is a prop rather than state. The page keeps it in the URL; the
 * drawer keeps it in memory.
 */
export function SupplierDetailsPanel({
  activeTab,
  canManage,
  canView,
  onTabChange,
  supplier,
}: SupplierDetailsPanelProps): JSX.Element {
  const statsQuery = useSupplierStats(supplier.id, canView);
  // Contacts and notes are small, cheap lists and their counts badge the
  // strip, so they load with the panel rather than only when their tab opens.
  const contactsQuery = useSupplierContacts(supplier.id, canView);
  const notesQuery = useSupplierNotes(supplier.id, canView);

  return (
    <div className="grid gap-6">
      <SupplierDetailViewTabs
        active={activeTab}
        contactsCount={contactsQuery.data?.length}
        notesCount={notesQuery.data?.length}
        onTabChange={onTabChange}
        supplierId={supplier.id}
      />

      {/* One panel element that swaps, which is what `aria-controls` on every
          tab points at. Each panel owns its own queries and only mounts when
          selected. */}
      <div id={SUPPLIER_DETAIL_TABPANEL_ID} role="tabpanel" tabIndex={-1}>
        {/* The stat cards live on the Profile tab rather than above the strip:
            on a phone they stand most of a screen tall, which would put the
            tabs below the fold and bring the long scroll back. */}
        {activeTab === "profile" ? (
          <div className="grid gap-6">
            <SupplierStatsCards stats={statsQuery.data} />
            <SupplierProfileCard supplier={supplier} />
          </div>
        ) : null}
        {activeTab === "contacts" ? (
          <SupplierContactsSection canManage={canManage} supplierId={supplier.id} />
        ) : null}
        {activeTab === "notes" ? (
          <SupplierNotesSection canManage={canManage} supplierId={supplier.id} />
        ) : null}
        {activeTab === "history" ? (
          <SupplierHistoryPanel canView={canView} supplierId={supplier.id} />
        ) : null}
        {activeTab === "documents" ? (
          <SupplierDocumentsPanel canView={canView} supplierId={supplier.id} />
        ) : null}
        {activeTab === "statement" ? (
          <SupplierStatementPanel canView={canView} supplierId={supplier.id} />
        ) : null}
      </div>
    </div>
  );
}
