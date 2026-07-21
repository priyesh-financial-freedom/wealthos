import { Button } from "@/components/ui/button";
import type { AssumptionProfile } from "@/types/assumptions";

interface ProfileSelectorProps {
  profiles: AssumptionProfile[];
  selectedProfileId: string | null;
  onSelect: (profileId: string) => void;
  onCreate: () => void;
  onDuplicate: () => void;
  onCompare: (profileId: string) => void;
  compareProfileId: string | null;
}

export function ProfileSelector({
  profiles,
  selectedProfileId,
  onSelect,
  onCreate,
  onDuplicate,
  onCompare,
  compareProfileId,
}: ProfileSelectorProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active Profile</span>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={selectedProfileId ?? ""}
              onChange={(event) => onSelect(event.target.value)}
            >
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                  {profile.isDefault ? " (Default)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Compare With</span>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={compareProfileId ?? ""}
              onChange={(event) => onCompare(event.target.value || "")}
            >
              <option value="">None</option>
              {profiles
                .filter((profile) => profile.id !== selectedProfileId)
                .map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onDuplicate} disabled={!selectedProfileId}>
            Duplicate Profile
          </Button>
          <Button type="button" onClick={onCreate}>
            Create Profile
          </Button>
        </div>
      </div>
    </div>
  );
}
