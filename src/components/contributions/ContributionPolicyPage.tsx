"use client";

import { useEffect, useMemo, useState } from "react";

import { ContributionEditor } from "@/components/contributions/ContributionEditor";
import { ContributionHistory } from "@/components/contributions/ContributionHistory";
import { ContributionPreview } from "@/components/contributions/ContributionPreview";
import { PolicyCard } from "@/components/contributions/PolicyCard";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingSpinner, ToastViewport } from "@/components/ui/feedback";
import { contributionService } from "@/services/contributions";
import type {
  ContributionEvent,
  ContributionFrequency,
  ContributionHistory as ContributionHistoryRecord,
  ContributionPolicy,
  ContributionPolicyCreateInput,
  ContributionPolicyStatus,
  ContributionPreview as ContributionPreviewModel,
} from "@/types/contributionPolicy";

export function ContributionPolicyPage() {
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<ContributionPolicy[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContributionPolicyStatus | "ALL">("ALL");
  const [frequencyFilter, setFrequencyFilter] = useState<ContributionFrequency | "ALL">("ALL");
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<ContributionPolicy | null>(null);
  const [previewPolicy, setPreviewPolicy] = useState<ContributionPolicy | null>(null);
  const [preview, setPreview] = useState<ContributionPreviewModel | null>(null);
  const [history, setHistory] = useState<ContributionHistoryRecord[]>([]);
  const [events, setEvents] = useState<ContributionEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refreshPolicies() {
    try {
      setLoading(true);
      const nextPolicies = await contributionService.listPolicies();
      setPolicies(nextPolicies);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load contribution policies.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshActivity(policyId?: string) {
    try {
      const [nextHistory, nextEvents] = await Promise.all([
        contributionService.listPolicyHistory(policyId),
        contributionService.listPolicyEvents(policyId),
      ]);
      setHistory(nextHistory);
      setEvents(nextEvents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load policy activity.");
    }
  }

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        setLoading(true);
        const [nextPolicies, nextHistory, nextEvents] = await Promise.all([
          contributionService.listPolicies(),
          contributionService.listPolicyHistory(),
          contributionService.listPolicyEvents(),
        ]);

        if (!mounted) {
          return;
        }

        setPolicies(nextPolicies);
        setHistory(nextHistory);
        setEvents(nextEvents);
        setError(null);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unable to load contribution policy data.");
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

    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!error) {
      return;
    }

    const timer = window.setTimeout(() => setError(null), 4200);
    return () => window.clearTimeout(timer);
  }, [error]);

  const filteredPolicies = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return policies.filter((policy) => {
      const queryPass =
        !normalizedQuery ||
        `${policy.name} ${policy.description ?? ""} ${policy.targetAccount ?? ""} ${policy.frequency} ${policy.status}`
          .toLowerCase()
          .includes(normalizedQuery);
      const statusPass = statusFilter === "ALL" || policy.status === statusFilter;
      const frequencyPass = frequencyFilter === "ALL" || policy.frequency === frequencyFilter;

      return queryPass && statusPass && frequencyPass;
    });
  }, [policies, query, statusFilter, frequencyFilter]);

  async function handleCreateOrUpdate(input: ContributionPolicyCreateInput) {
    setBusy(true);
    setError(null);

    try {
      if (editingPolicy) {
        await contributionService.updatePolicy({ id: editingPolicy.id, ...input });
        setNotice("Contribution policy updated.");
      } else {
        await contributionService.createPolicy(input);
        setNotice("Contribution policy created.");
      }

      setEditorOpen(false);
      setEditingPolicy(null);
      await Promise.all([refreshPolicies(), refreshActivity()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save policy.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleStatus(policy: ContributionPolicy) {
    setBusy(true);
    setError(null);

    try {
      if (policy.status === "ACTIVE") {
        const reason = window.prompt("Optional reason for pause") || undefined;
        await contributionService.pausePolicy(policy.id, reason);
        setNotice("Policy paused.");
      } else {
        await contributionService.resumePolicy(policy.id);
        setNotice("Policy resumed.");
      }

      await Promise.all([refreshPolicies(), refreshActivity(policy.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update policy status.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicate(policy: ContributionPolicy) {
    const duplicateName = window.prompt("Duplicate policy name", `${policy.name} Copy`) || "";
    if (!duplicateName.trim()) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await contributionService.duplicatePolicy(policy.id, duplicateName.trim());
      setNotice("Policy duplicated.");
      await Promise.all([refreshPolicies(), refreshActivity()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to duplicate policy.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGeneratePreview(policy: ContributionPolicy, horizonMonths = 24) {
    setBusy(true);
    setError(null);

    try {
      const nextPreview = await contributionService.generatePreview(policy.id, { horizonMonths });
      setPreview(nextPreview);
      setPreviewPolicy(policy);
      setPreviewOpen(true);
      await refreshActivity(policy.id);
      setNotice("Preview generated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate preview.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <PageHeader
            title="Contribution Policy Engine"
            description="Reusable recurring contribution policies for investments with event-driven history and projection-compatible previews."
          />
          <Button
            onClick={() => {
              setEditingPolicy(null);
              setEditorOpen(true);
            }}
            disabled={busy}
          >
            Add Policy
          </Button>
        </div>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />
        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-200/70">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Policies</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{filteredPolicies.length}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm shadow-emerald-100">
            <p className="text-xs uppercase tracking-wide text-emerald-700">Active</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-900">{filteredPolicies.filter((policy) => policy.status === "ACTIVE").length}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm shadow-amber-100">
            <p className="text-xs uppercase tracking-wide text-amber-700">Paused</p>
            <p className="mt-1 text-2xl font-semibold text-amber-900">{filteredPolicies.filter((policy) => policy.status === "PAUSED").length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-200/70">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Events</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{events.length}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
          <div className="grid gap-3 md:grid-cols-4">
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              placeholder="Search by name, target, status..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ContributionPolicyStatus | "ALL")}>
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
            </select>
            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={frequencyFilter} onChange={(event) => setFrequencyFilter(event.target.value as ContributionFrequency | "ALL")}>
              <option value="ALL">All frequencies</option>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="ANNUALLY">Annually</option>
            </select>
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
            <LoadingSpinner label="Loading contribution policies..." />
          </div>
        ) : filteredPolicies.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
            <h2 className="text-lg font-semibold text-slate-900">No contribution policies yet</h2>
            <p className="mt-2 text-sm text-slate-600">Create your first recurring contribution policy to start policy-driven investing.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPolicies.map((policy) => (
              <PolicyCard
                key={policy.id}
                policy={policy}
                onEdit={(selected) => {
                  setEditingPolicy(selected);
                  setEditorOpen(true);
                }}
                onDuplicate={(selected) => {
                  void handleDuplicate(selected);
                }}
                onToggleStatus={(selected) => {
                  void handleToggleStatus(selected);
                }}
                onPreview={(selected) => {
                  void handleGeneratePreview(selected);
                }}
              />
            ))}
          </div>
        )}

        <ContributionPreview preview={preview} />
        <ContributionHistory history={history} events={events} />

        <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editingPolicy ? "Edit Policy" : "Create Policy"}</DialogTitle>
            </DialogHeader>
            <ContributionEditor
              initialData={editingPolicy}
              submitting={busy}
              onCancel={() => {
                setEditorOpen(false);
                setEditingPolicy(null);
              }}
              onSubmit={async (input) => {
                await handleCreateOrUpdate(input);
              }}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>Contribution Preview {previewPolicy ? `- ${previewPolicy.name}` : ""}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-wrap gap-2">
              {[12, 24, 36].map((months) => (
                <Button
                  key={months}
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (previewPolicy) {
                      void handleGeneratePreview(previewPolicy, months);
                    }
                  }}
                  disabled={busy || !previewPolicy}
                >
                  {months} months
                </Button>
              ))}
            </div>
            <ContributionPreview preview={preview} />
          </DialogContent>
        </Dialog>
      </PageContainer>
    </AppLayout>
  );
}
