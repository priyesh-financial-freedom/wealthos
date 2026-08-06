"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { RebuildDraftActionState } from "./rebuildAugustDraftAction";

type DuplicateGroup = {
  groupKey: string;
  itemKey: string;
  entityName: string;
  rowCount: number;
  entityTypes: string[];
  entityIds: string[];
  totalActualValue: number;
};

type RebuildDraftActionResult = {
  closeId: string;
  closeYear: number;
  closeMonth: number;
  status: "draft";
  beforeItemCount: number;
  afterItemCount: number;
  beforeTotals: {
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
    totalsByKey: Record<string, number>;
  };
  afterTotals: {
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
    totalsByKey: Record<string, number>;
  };
  beforeDuplicateGroups: DuplicateGroup[];
  afterDuplicateGroups: DuplicateGroup[];
  duplicateGroupsRemoved: DuplicateGroup[];
};

type ClientActionState = RebuildDraftActionState & {
  result?: RebuildDraftActionResult;
};

interface RebuildDraftActionProps {
  closeId: string;
  action: (prevState: ClientActionState, formData: FormData) => Promise<ClientActionState>;
}

const INITIAL_STATE: ClientActionState = {
  ok: false,
  status: 0,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Rebuilding..." : "Rebuild August Draft From Canonical Sources"}
    </Button>
  );
}

export function RebuildDraftAction({ closeId, action }: RebuildDraftActionProps) {
  const router = useRouter();
  const [response, formAction] = useActionState(action, INITIAL_STATE);
  const refreshedAfterSuccess = useRef(false);

  useEffect(() => {
    if (!response.ok || refreshedAfterSuccess.current) {
      return;
    }

    refreshedAfterSuccess.current = true;
    router.refresh();
  }, [response.ok, router]);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">Internal Repair Action</p>
      <p className="mt-1 text-sm text-amber-800">Rebuild August 2026 draft close from canonical live sources (draft-only, incident-scoped).</p>
      <div className="mt-3 flex items-center gap-3">
        <form action={formAction}>
          <input type="hidden" name="closeId" value={closeId} />
          <SubmitButton />
        </form>
        <span className="text-xs text-amber-900">close_id: {closeId}</span>
      </div>

      {response.status !== 0 ? (
        <div className={`mt-4 rounded-lg border p-3 text-sm ${response.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
          {response.ok && response.result ? (
            <div className="space-y-1">
              <p className="font-medium">Rebuild completed.</p>
              <p>Before item count: {response.result.beforeItemCount}</p>
              <p>After item count: {response.result.afterItemCount}</p>
              <p>Before totals: assets={response.result.beforeTotals.totalAssets}, liabilities={response.result.beforeTotals.totalLiabilities}, netWorth={response.result.beforeTotals.netWorth}</p>
              <p>After totals: assets={response.result.afterTotals.totalAssets}, liabilities={response.result.afterTotals.totalLiabilities}, netWorth={response.result.afterTotals.netWorth}</p>
              <p>Duplicate groups removed: {response.result.duplicateGroupsRemoved.length}</p>
              {response.result.duplicateGroupsRemoved.length > 0 ? (
                <ul className="list-disc pl-5">
                  {response.result.duplicateGroupsRemoved.map((group) => (
                    <li key={group.groupKey}>
                      {group.itemKey} - {group.entityName} ({group.rowCount} rows before)
                    </li>
                  ))}
                </ul>
              ) : null}
              <p>Page refreshed after rebuild. Current reconciliation below reflects the latest draft rows.</p>
            </div>
          ) : (
            <p>{response.error ?? "Rebuild failed."}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
