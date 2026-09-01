import type { JSX } from "react";

import type { SettingsSection } from "@/types/settings";

import { SettingsSectionCard } from "./settings-section-card";

type SettingsGridProps = {
  canManage: (section: SettingsSection) => boolean;
  onOpenSection: (section: SettingsSection) => void;
  sections: SettingsSection[];
};

/**
 * Hairline-divided list, the same idiom as the inventory summary and the
 * dashboard KPI row. It replaced a three-column card grid: eighteen settings
 * destinations at identical weight is a wall to scan, and the page already
 * groups them under "Business Settings" and "Master Data" headings, which is
 * where the structure belongs.
 */
export function SettingsGrid({
  canManage,
  onOpenSection,
  sections,
}: SettingsGridProps): JSX.Element {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <ul className="grid gap-px bg-border">
        {sections.map((section) => (
          <SettingsSectionCard
            key={section.id}
            canManage={canManage(section)}
            onOpen={() => onOpenSection(section)}
            section={section}
          />
        ))}
      </ul>
    </div>
  );
}
