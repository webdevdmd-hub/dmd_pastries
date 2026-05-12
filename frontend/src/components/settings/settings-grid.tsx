import type { JSX } from "react";

import type { SettingsSection } from "@/types/settings";

import { SettingsSectionCard } from "./settings-section-card";

type SettingsGridProps = {
  canManage: (section: SettingsSection) => boolean;
  onOpenSection: (section: SettingsSection) => void;
  sections: SettingsSection[];
};

export function SettingsGrid({
  canManage,
  onOpenSection,
  sections,
}: SettingsGridProps): JSX.Element {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {sections.map((section) => (
        <SettingsSectionCard
          key={section.id}
          canManage={canManage(section)}
          onOpen={() => onOpenSection(section)}
          section={section}
        />
      ))}
    </div>
  );
}
