import type { JSX, ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

type AppCardTone = "default" | "warm" | "white" | "danger" | "success" | "warning";

type AppCardProps = {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  title?: ReactNode;
  tone?: AppCardTone;
};

const toneClasses: Record<AppCardTone, string> = {
  default: "bg-workspace-panel",
  warm: "bg-brand-latte",
  white: "bg-workspace-panel",
  danger: "border-danger/30 bg-danger-tint/80",
  success: "border-money/30 bg-money-tint/80",
  warning: "border-warning/30 bg-warning-tint/80",
};

export function AppCard({
  actions,
  children,
  className,
  description,
  title,
  tone = "default",
}: AppCardProps): JSX.Element {
  return (
    <Card className={cn(toneClasses[tone], className)}>
      {title || description || actions ? (
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              {title ? <CardTitle>{title}</CardTitle> : null}
              {description ? <CardDescription>{description}</CardDescription> : null}
            </div>
            {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
          </div>
        </CardHeader>
      ) : null}
      <CardContent className={title || description || actions ? undefined : "p-6"}>
        {children}
      </CardContent>
    </Card>
  );
}
