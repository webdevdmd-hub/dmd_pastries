import type { JSX, ReactNode } from "react";

import { AppButton } from "@/components/app/app-button";
import { Card, CardContent } from "@/components/ui/card";

type AppEmptyStateProps = {
  actionLabel?: string;
  description: string;
  icon?: ReactNode;
  onAction?: () => void;
  title: string;
};

export function AppEmptyState({
  actionLabel,
  description,
  icon,
  onAction,
  title,
}: AppEmptyStateProps): JSX.Element {
  return (
    <Card className="bg-white/80">
      <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
        {icon ? <div className="text-brand-mocha">{icon}</div> : null}
        <div>
          <h2 className="text-2xl font-bold text-brand-espresso">{title}</h2>
          <p className="mt-2 max-w-xl text-sm text-brand-mocha">{description}</p>
        </div>
        {actionLabel && onAction ? (
          <AppButton onClick={onAction} type="button">
            {actionLabel}
          </AppButton>
        ) : null}
      </CardContent>
    </Card>
  );
}
