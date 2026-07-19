"use client";

import { useEffect, useMemo, useState } from "react";

import {
  RetirementAccountForm,
  RetirementAccountsTable,
  RetirementDashboard,
  RetirementDetailDialog,
} from "@/components/retirement";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingSpinner, ToastViewport } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import {
  buildRetirementDashboardModel,
  createRetirementAccount,
  deleteRetirementAccount,
  getRetirementAccounts,
  updateRetirementAccount,
} from "@/services/retirement";
import type {
  RetirementAccount,
  RetirementAccountInsert,
  RetirementAccountType,
} from "@/types/retirementAccount";

type AccountModalState =
  | { kind: "create" }
  | { kind: "edit"; account: RetirementAccount }
  | null;

export default function RetirementPage() {
  const [accounts, setAccounts] = useState<RetirementAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingAccount, setSavingAccount] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | RetirementAccountType>("all");
  const [sortValue, setSortValue] = useState("current_balance:desc");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [accountModal, setAccountModal] = useState<AccountModalState>(null);
  const [detailAccount, setDetailAccount] = useState<RetirementAccount | null>(null);

  async function loadData() {
    setError(null);

    try {
      const retirementAccounts = await getRetirementAccounts();
      const retirementModel = buildRetirementDashboardModel(retirementAccounts);

      setAccounts(retirementAccounts);
      setDashboardModel(retirementModel);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load retirement data");
    }
  }

  const [dashboardModel, setDashboardModel] = useState(() => buildRetirementDashboardModel([]));

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        setLoading(true);
        await loadData();
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!error) {
      return;
    }

    const timer = window.setTimeout(() => setError(null), 4500);
    return () => window.clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    const requestedType = new URLSearchParams(window.location.search).get("type");
    if (requestedType === "PPF" || requestedType === "EPF" || requestedType === "NPS") {
      setTypeFilter(requestedType);
      return;
    }

    setTypeFilter("all");
  }, []);

  const filteredAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const [sortField, sortDirection] = sortValue.split(":") as ["current_balance" | "institution" | "updated_at", "asc" | "desc"];

    return [...accounts]
      .filter((account) => {
        const matchesQuery =
          !normalizedQuery ||
          `${account.account_type} ${account.owner} ${account.institution} ${account.account_number ?? ""} ${account.nominee ?? ""} ${account.notes ?? ""}`
            .toLowerCase()
            .includes(normalizedQuery);
        const matchesType = typeFilter === "all" || account.account_type === typeFilter;

        return matchesQuery && matchesType;
      })
      .sort((left, right) => {
        const leftValue = left[sortField] ?? "";
        const rightValue = right[sortField] ?? "";
        const direction = sortDirection === "asc" ? 1 : -1;

        if (typeof leftValue === "number" && typeof rightValue === "number") {
          return (leftValue - rightValue) * direction;
        }

        return String(leftValue).localeCompare(String(rightValue)) * direction;
      });
  }, [accounts, query, sortValue, typeFilter]);

  async function handleSaveAccount(values: RetirementAccountInsert) {
    setSavingAccount(true);
    setError(null);
    setNotice(null);

    try {
      if (accountModal?.kind === "edit") {
        await updateRetirementAccount({ id: accountModal.account.id, ...values });
        setNotice("Retirement account updated successfully.");
      } else {
        await createRetirementAccount(values);
        setNotice("Retirement account created successfully.");
      }
      setAccountModal(null);
      await loadData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save retirement account");
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleDeleteAccount(account: RetirementAccount) {
    const confirmed = window.confirm(`Delete ${account.account_type} at ${account.institution}?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteRetirementAccount(account.id, account.account_type);
      setNotice("Retirement account deleted successfully.");
      await loadData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete retirement account");
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <PageHeader
            title="Retirement"
            description="Track PPF, EPF, and NPS balances and recurring contribution schedules in dedicated modules."
          />
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setAccountModal({ kind: "create" })}>Add Retirement Account</Button>
          </div>
        </div>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />
        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />

        {loading ? (
          <RetirementPageSkeleton />
        ) : (
          <>
            <RetirementDashboard model={dashboardModel} emptyState={accounts.length === 0} />

            <div className="flex flex-wrap gap-2">
              {[
                { label: "All", value: "all" as const },
                { label: "PPF", value: "PPF" as const },
                { label: "EPF", value: "EPF" as const },
                { label: "NPS", value: "NPS" as const },
              ].map((option) => (
                <Button key={option.value} type="button" variant={typeFilter === option.value ? "default" : "outline"} onClick={() => setTypeFilter(option.value)}>
                  {option.label}
                </Button>
              ))}
            </div>

            <DashboardCard>
              <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr_0.8fr_1fr]">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="retirement-search">
                    Search
                  </label>
                  <Input id="retirement-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by institution, holder, account number, or notes" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="retirement-filter-type">
                    Module
                  </label>
                  <select id="retirement-filter-type" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "all" | RetirementAccountType)}>
                    <option value="all">All types</option>
                    <option value="PPF">PPF</option>
                    <option value="EPF">EPF</option>
                    <option value="NPS">NPS</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700" htmlFor="retirement-sort">
                    Sort by
                  </label>
                  <select id="retirement-sort" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={sortValue} onChange={(event) => setSortValue(event.target.value)}>
                    <option value="current_balance:desc">Highest balance</option>
                    <option value="current_balance:asc">Lowest balance</option>
                    <option value="institution:asc">Institution A-Z</option>
                    <option value="updated_at:desc">Recently updated</option>
                  </select>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm text-slate-500">Visible retirement accounts</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{filteredAccounts.length}</p>
                </div>
              </div>
            </DashboardCard>

            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">Retirement Accounts</h2>
                <p className="text-sm text-slate-500">Shared CRUD workflow across PPF, EPF, and NPS account modules.</p>
              </div>
              <RetirementAccountsTable
                accounts={filteredAccounts}
                onView={setDetailAccount}
                onEdit={(account) => setAccountModal({ kind: "edit", account })}
                onDelete={handleDeleteAccount}
              />
            </section>
          </>
        )}

        <Dialog open={accountModal !== null} onOpenChange={(open) => !open && setAccountModal(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{accountModal?.kind === "edit" ? "Edit retirement account" : "Add retirement account"}</DialogTitle>
            </DialogHeader>
            <RetirementAccountForm
              initialData={accountModal?.kind === "edit" ? accountModal.account : null}
              onSubmit={handleSaveAccount}
              onCancel={() => setAccountModal(null)}
              submitting={savingAccount}
            />
          </DialogContent>
        </Dialog>

        <RetirementDetailDialog account={detailAccount} open={detailAccount !== null} onOpenChange={(open) => !open && setDetailAccount(null)} />
      </PageContainer>
    </AppLayout>
  );
}

function RetirementPageSkeleton() {
  return (
    <div className="space-y-6">
      <DashboardCard className="overflow-hidden border-[#2b2414] bg-[linear-gradient(135deg,#09090b_0%,#111827_60%,#1f2937_100%)] text-white">
        <div className="grid gap-4 p-6 md:grid-cols-3">
          <div className="h-6 w-48 rounded bg-white/10" />
          <div className="h-24 rounded-2xl bg-white/10" />
          <div className="h-24 rounded-2xl bg-white/10" />
        </div>
      </DashboardCard>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <DashboardCard key={index} className="h-32 animate-pulse bg-slate-100">
            <div />
          </DashboardCard>
        ))}
      </div>
      <DashboardCard>
        <LoadingSpinner label="Loading retirement analytics..." />
      </DashboardCard>
    </div>
  );
}
