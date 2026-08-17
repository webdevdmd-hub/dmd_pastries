"use client";

import type { JSX } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RecipeInstructionsCard({
  instructions,
}: {
  instructions: string | null;
}): JSX.Element {
  return (
    <Card className="bg-card/80">
      <CardHeader>
        <CardTitle>Instructions</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap text-sm leading-6 text-brand-mocha">
          {instructions ?? "No production instructions recorded yet."}
        </p>
      </CardContent>
    </Card>
  );
}
