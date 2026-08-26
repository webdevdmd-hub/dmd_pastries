import type { JSX } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Branch } from "@/types/branch";

type ReportBranchSelectProps = {
  branches: Branch[];
  canAccessAllBranches: boolean;
  currentBranchId: string | null;
  onChange: (branchId: string) => void;
  value: string;
};

export function ReportBranchSelect({
  branches,
  canAccessAllBranches,
  currentBranchId,
  onChange,
  value,
}: ReportBranchSelectProps): JSX.Element {
  return (
    <div className="space-y-2">
      <label
        htmlFor="report-branch-select-branch"
        className="text-sm font-medium text-brand-espresso"
      >
        Branch
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="report-branch-select-branch">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {canAccessAllBranches ? <SelectItem value="all">All branches</SelectItem> : null}
          {branches
            .filter((branch) => branch.status === "active")
            .map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name} ({branch.code})
              </SelectItem>
            ))}
          {!canAccessAllBranches && currentBranchId && branches.length === 0 ? (
            <SelectItem value={currentBranchId}>Current branch</SelectItem>
          ) : null}
        </SelectContent>
      </Select>
    </div>
  );
}
