import type { JSX, ReactNode } from "react";

import { AppCard } from "@/components/app/app-card";

type AppSectionCardProps = {
  actions?: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  title: ReactNode;
};

export function AppSectionCard({
  actions,
  children,
  description,
  title,
}: AppSectionCardProps): JSX.Element {
  return (
    <AppCard actions={actions} description={description} title={title} tone="white">
      {children}
    </AppCard>
  );
}
