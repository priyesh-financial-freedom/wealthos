"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

const INCIDENT_CLOSE_ID = "f8df4b99-744f-4301-a6d4-e916df3abc78";
const REBUILD_RESULT_STORAGE_KEY = "wealthos:august-draft-rebuild-result";

type DuplicateGroup = {
  groupKey: string;
  itemKey: string;
  entityName: string;
  rowCount: number;
  entityTypes: string[];
  entityIds: string[];
  totalActualValue: number;
};

type RebuildResponse = {
  ok: boolean;
  error?: string;
  result?: {
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
};

export function RebuildDraftAction() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<RebuildResponse | null>(null);

  useEffect(() => {
    const raw = window.sessionStorage.getItem(REBUILD_RESULT_STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      setResponse(JSON.parse(raw) as RebuildResponse);
    } catch {
      window.sessionStorage.removeItem(REBUILD_RESULT_STORAGE_KEY);
    }
  }, []);

  async function rebuild() {
    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch("/api/debug/month-end-close/rebuild-draft", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ closeId: INCIDENT_CLOSE_ID }),
      });

      const payload = (await res.json()) as RebuildResponse;
      window.sessionStorage.setItem(REBUILD_RESULT_STORAGE_KEY, JSON.stringify(payload));
      setResponse(payload);

      if (payload.ok) {
        router.refresh();
      }
    } catch (error) {
      const payload = { ok: false, error: error instanceof Error ? error.message : "Request failed." };
      window.sessionStorage.setItem(REBUILD_RESULT_STORAGE_KEY, JSON.stringify(payload));
      setResponse(payload);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">Internal Repair Action</p>
      <p className="mt-1 text-sm text-amber-800">Rebuild August 2026 draft close from canonical live sources (draft-only, incident-scoped).</p>
      <div className="mt-3 flex items-center gap-3">
        <Button type="button" onClick={rebuild} disabled={loading}>
          {loading ? "Rebuilding..." : "Rebuild August Draft From Canonical Sources"}
        </Button>
        <span className="text-xs text-amber-900">close_id: {INCIDENT_CLOSE_ID}</span>
      </div>

      {response ? (
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
