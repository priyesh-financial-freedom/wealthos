import { Button } from "@/components/ui/button";
import type { PolicyVersion } from "@/types/assumptions";

interface VersionHistoryProps {
  versions: PolicyVersion[];
  onCreateVersion: () => void;
  busy: boolean;
}

export function VersionHistory({ versions, onCreateVersion, busy }: VersionHistoryProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Version History</h2>
        <Button type="button" variant="outline" onClick={onCreateVersion} disabled={busy}>
          {busy ? "Saving..." : "Create Version"}
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {versions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">No policy versions created yet.</p>
        ) : (
          versions.map((version) => (
            <div key={version.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">V{version.versionNumber}: {version.versionName}</p>
                <p className="text-xs text-slate-500">{new Date(version.createdAt).toLocaleString()}</p>
              </div>
              {version.notes ? <p className="mt-1 text-xs text-slate-600">{version.notes}</p> : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
