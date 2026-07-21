"use client";

import { useEffect, useMemo, useState } from "react";

import { AssumptionCategoryCard } from "@/components/assumptions/AssumptionCategoryCard";
import { AssumptionEditor } from "@/components/assumptions/AssumptionEditor";
import { ProfileSelector } from "@/components/assumptions/ProfileSelector";
import { VersionHistory } from "@/components/assumptions/VersionHistory";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingSpinner, ToastViewport } from "@/components/ui/feedback";
import { assumptionService } from "@/services/assumptions/index";
import type { AssumptionProfileState } from "@/services/assumptions/index";
import type { PolicyVersion, ProfileComparisonItem } from "@/types/assumptions";

export function AssumptionPage() {
  const [loading, setLoading] = useState(true);
  const [profileState, setProfileState] = useState<AssumptionProfileState | null>(null);
  const [profiles, setProfiles] = useState<AssumptionProfileState["profile"][]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [compareProfileId, setCompareProfileId] = useState<string | null>(null);
  const [differences, setDifferences] = useState<ProfileComparisonItem[]>([]);
  const [mode, setMode] = useState<"SIMPLE" | "ADVANCED">("SIMPLE");
  const [search, setSearch] = useState("");
  const [savingAssumptionId, setSavingAssumptionId] = useState<string | null>(null);
  const [savingVersion, setSavingVersion] = useState(false);
  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        setLoading(true);
        const current = await assumptionService.getCurrentProfile();
        const allProfiles = await assumptionService.listProfiles();
        const profileVersions = await assumptionService.listVersions(current.profile.id);

        if (!mounted) {
          return;
        }

        setProfileState(current);
        setProfiles(allProfiles);
        setVersions(profileVersions);
        setSelectedCategoryId(current.categories[0]?.id ?? null);
        setError(null);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unable to load assumptions.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    async function loadDifferences() {
      if (!profileState || !compareProfileId) {
        setDifferences([]);
        return;
      }

      try {
        const result = await assumptionService.compareProfiles(profileState.profile.id, compareProfileId);
        setDifferences(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to compare profiles.");
      }
    }

    void loadDifferences();
  }, [compareProfileId, profileState]);

  const assumptionsForCategory = useMemo(() => {
    if (!profileState || !selectedCategoryId) {
      return [];
    }

    return profileState.assumptions.filter((assumption) => assumption.categoryId === selectedCategoryId);
  }, [profileState, selectedCategoryId]);

  const countsByCategoryId = useMemo(() => {
    const counts = new Map<string, number>();

    if (!profileState) {
      return counts;
    }

    for (const assumption of profileState.assumptions) {
      counts.set(assumption.categoryId, (counts.get(assumption.categoryId) ?? 0) + 1);
    }

    return counts;
  }, [profileState]);

  async function refreshProfile(profileId: string, options?: { setAsActive?: boolean }) {
    if (options?.setAsActive) {
      await assumptionService.setActiveProfile(profileId);
    }

    const [nextState, nextProfiles, nextVersions] = await Promise.all([
      assumptionService.getProfile(profileId),
      assumptionService.listProfiles(),
      assumptionService.listVersions(profileId),
    ]);

    setProfileState(nextState);
    setProfiles(nextProfiles);
    setVersions(nextVersions);
    setSelectedCategoryId((current) => current ?? nextState.categories[0]?.id ?? null);
  }

  async function handleCreateProfile() {
    const profileName = window.prompt("Enter new profile name");
    if (!profileName) {
      return;
    }

    try {
      const profile = await assumptionService.createProfile({ name: profileName.trim(), isActive: true });
      await refreshProfile(profile.id);
      setNotice("Profile created.");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create profile.");
    }
  }

  async function handleDuplicateProfile() {
    if (!profileState) {
      return;
    }

    const profileName = window.prompt("Enter duplicate profile name", `${profileState.profile.name} Copy`);
    if (!profileName) {
      return;
    }

    try {
      const profile = await assumptionService.duplicateProfile(profileState.profile.id, { name: profileName.trim(), isActive: true });
      await refreshProfile(profile.id);
      setNotice("Profile duplicated.");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to duplicate profile.");
    }
  }

  async function handleAssumptionSave(assumptionId: string, value: unknown) {
    if (!profileState) {
      return;
    }

    try {
      setSavingAssumptionId(assumptionId);
      const nextState = await assumptionService.updateAssumption({
        profileId: profileState.profile.id,
        assumptionId,
        value,
      });

      setProfileState(nextState);
      setNotice("Assumption updated.");
      setError(null);
      setValidationMessage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update assumption.");
    } finally {
      setSavingAssumptionId(null);
    }
  }

  async function handleCreateVersion() {
    if (!profileState) {
      return;
    }

    try {
      setSavingVersion(true);
      const versionName = window.prompt("Version name", `Snapshot ${new Date().toLocaleDateString()}`) ?? undefined;
      await assumptionService.createVersion(profileState.profile.id, {
        versionName,
        notes: "Manual snapshot",
      });
      const nextVersions = await assumptionService.listVersions(profileState.profile.id);
      setVersions(nextVersions);
      setNotice("Version created.");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create version.");
    } finally {
      setSavingVersion(false);
    }
  }

  async function handleValidateProfile() {
    if (!profileState) {
      return;
    }

    try {
      const result = await assumptionService.validateProfile(profileState.profile.id);
      if (result.isValid) {
        setValidationMessage("Profile validation passed.");
        setNotice("Validation completed.");
      } else {
        setValidationMessage(`Validation found ${result.issues.length} issue(s). ${result.issues[0]?.message ?? ""}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to validate profile.");
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="Assumptions" description="Executive control panel for policy assumptions used across planning modules." />

        {loading ? (
          <LoadingSpinner label="Loading assumptions engine..." />
        ) : profileState ? (
          <>
            <ProfileSelector
              profiles={profiles}
              selectedProfileId={profileState.profile.id}
              onSelect={(profileId) => {
                void refreshProfile(profileId, { setAsActive: true });
              }}
              onCreate={() => {
                void handleCreateProfile();
              }}
              onDuplicate={() => {
                void handleDuplicateProfile();
              }}
              onCompare={(profileId) => setCompareProfileId(profileId || null)}
              compareProfileId={compareProfileId}
            />

            <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)_360px]">
              <AssumptionCategoryCard
                categories={profileState.categories}
                selectedCategoryId={selectedCategoryId}
                countsByCategoryId={countsByCategoryId}
                onSelect={setSelectedCategoryId}
              />

              <AssumptionEditor
                assumptions={assumptionsForCategory}
                mode={mode}
                search={search}
                onModeChange={setMode}
                onSearchChange={setSearch}
                onSaveAssumption={handleAssumptionSave}
                savingAssumptionId={savingAssumptionId}
              />

              <div className="space-y-4">
                <VersionHistory versions={versions} onCreateVersion={handleCreateVersion} busy={savingVersion} />

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Profile Controls</h2>
                  <button
                    type="button"
                    className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      void handleValidateProfile();
                    }}
                  >
                    Validate Profile
                  </button>
                  {validationMessage ? <p className="mt-2 text-xs text-slate-600">{validationMessage}</p> : null}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Compare Profiles</h2>
                  <p className="mt-2 text-sm text-slate-700">Differences found: {differences.length}</p>
                  <div className="mt-3 max-h-48 space-y-2 overflow-auto pr-1">
                    {differences.slice(0, 12).map((item) => (
                      <div key={item.assumptionId} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
                        <p className="text-xs font-semibold text-slate-800">{item.assumptionName}</p>
                        <p className="text-xs text-slate-600">{String(item.leftValue)} {"->"} {String(item.rightValue)}</p>
                      </div>
                    ))}
                    {differences.length === 0 ? <p className="text-xs text-slate-500">No differences for selected profile pair.</p> : null}
                  </div>
                </section>
              </div>
            </div>
          </>
        ) : (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Unable to load profile state.</p>
        )}

        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />
        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />
      </PageContainer>
    </AppLayout>
  );
}
