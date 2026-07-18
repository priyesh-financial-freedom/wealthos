"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AccountEngineKpiCards,
  AccountEngineTrendCards,
  UniversalAccountDetailDialog,
  UniversalAccountFilters,
  UniversalAccountForm,
  UniversalAccountsTable,
  UniversalMonthlySnapshotForm,
  UniversalMonthlySnapshotsTable,
} from "@/components/accountEngine";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  buildUniversalAccountMetrics,
  buildUniversalDashboardSummary,
  createUniversalAccount,
  createUniversalAccountMonthlySnapshot,
  deleteUniversalAccount,
  deleteUniversalAccountMonthlySnapshot,
  getUniversalAccounts,
  getUniversalAccountMonthlySnapshots,
  updateUniversalAccount,
  updateUniversalAccountMonthlySnapshot,
} from "@/services/universalAccounts";
import type {
  UniversalAccount,
  UniversalAccountInsert,
  UniversalAccountMetrics,
  UniversalAccountMonthlySnapshot,
  UniversalAccountMonthlySnapshotInsert,
  UniversalDashboardSummary,
} from "@/types/universalAccount";

type AccountModalState =
  | { kind: "create" }
  | { kind: "edit"; account: UniversalAccount }
  | null;

type SnapshotModalState =
  | { kind: "create" }
  | { kind: "edit"; snapshot: UniversalAccountMonthlySnapshot }
  | null;

const initialSummary: UniversalDashboardSummary = {
  totalCurrentValue: 0,
  totalCash: 0,
  totalLiabilities: 0,
  monthlyInflow: 0,
  monthlyOutflow: 0,
  liquidityRatio: null,
  trend: [],
  allocation: [],
};

export default function UniversalAccountsPage() {
  const [accounts, setAccounts] = useState<UniversalAccount[]>([]);
  const [metricsByAccountId, setMetricsByAccountId] = useState<Record<string, UniversalAccountMetrics>>({});
  const [snapshots, setSnapshots] = useState<UniversalAccountMonthlySnapshot[]>([]);
  const [summary, setSummary] = useState<UniversalDashboardSummary>(initialSummary);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortValue, setSortValue] = useState("current_value:desc");

  const [accountModal, setAccountModal] = useState<AccountModalState>(null);
  const [snapshotModal, setSnapshotModal] = useState<SnapshotModalState>(null);
  const [detailAccount, setDetailAccount] = useState<UniversalAccount | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountTypes = useMemo(() => Array.from(new Set(accounts.map((account) => account.account_type))), [accounts]);

  const filteredAccounts = useMemo(() => {
    const [sortField, sortOrder] = sortValue.split(":") as [keyof UniversalAccount, "asc" | "desc"];

    const filtered = accounts.filter((account) => {
      const matchesQuery =
        account.name.toLowerCase().includes(query.toLowerCase()) ||
        (account.institution || "").toLowerCase().includes(query.toLowerCase()) ||
        account.account_type.toLowerCase().includes(query.toLowerCase());
      const matchesType = typeFilter === "all" || account.account_type === typeFilter;
      const matchesStatus = statusFilter === "all" || account.status === statusFilter;
      return matchesQuery && matchesType && matchesStatus;
    });

    return filtered.sort((a, b) => {
      const left = a[sortField] ?? "";
      const right = b[sortField] ?? "";

      if (typeof left === "number" && typeof right === "number") {
        return sortOrder === "asc" ? left - right : right - left;
      }

      const leftValue = String(left).toLowerCase();
      const rightValue = String(right).toLowerCase();
      if (leftValue < rightValue) return sortOrder === "asc" ? -1 : 1;
      if (leftValue > rightValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [accounts, query, typeFilter, statusFilter, sortValue]);

  const loadData = useCallback(async () => {
    setError(null);

    try {
      const [accountsResponse, snapshotsResponse] = await Promise.all([
        getUniversalAccounts(),
        getUniversalAccountMonthlySnapshots(),
      ]);

      const totalPortfolioValue = accountsResponse.reduce((sum, account) => sum + Number(account.current_value ?? 0), 0);
      const metrics = Object.fromEntries(
        accountsResponse.map((account) => [
          account.id,
          buildUniversalAccountMetrics(account, snapshotsResponse, totalPortfolioValue),
        ]),
      );
      const dashboardSummary = buildUniversalDashboardSummary(accountsResponse, snapshotsResponse);

      setAccounts(accountsResponse);
      setMetricsByAccountId(metrics);
      setSnapshots(snapshotsResponse);
      setSummary(dashboardSummary);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load universal account data.";
      setError(message);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function initialize() {
      setLoading(true);
      await loadData();
      if (mounted) {
        setLoading(false);
      }
    }

    initialize();
    return () => {
      mounted = false;
    };
  }, [loadData]);

  async function handleSaveAccount(values: UniversalAccountInsert) {
    setSavingAccount(true);
    setError(null);
    try {
      if (accountModal?.kind === "edit") {
        await updateUniversalAccount({ id: accountModal.account.id, ...values });
      } else {
        await createUniversalAccount(values);
      }
      setAccountModal(null);
      await loadData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save account.");
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleDeleteAccount(account: UniversalAccount) {
    const confirmed = window.confirm(`Delete ${account.name}? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setError(null);
    try {
      await deleteUniversalAccount(account.id);
      if (detailAccount?.id === account.id) {
        setDetailAccount(null);
      }
      await loadData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account.");
    }
  }

  async function handleSaveSnapshot(values: UniversalAccountMonthlySnapshotInsert) {
    setSavingSnapshot(true);
    setError(null);
    try {
      if (snapshotModal?.kind === "edit") {
        await updateUniversalAccountMonthlySnapshot({ id: snapshotModal.snapshot.id, ...values });
      } else {
        await createUniversalAccountMonthlySnapshot(values);
      }
      setSnapshotModal(null);
      await loadData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save monthly snapshot.");
    } finally {
      setSavingSnapshot(false);
    }
  }

  async function handleDeleteSnapshot(snapshot: UniversalAccountMonthlySnapshot) {
    const confirmed = window.confirm("Delete this monthly snapshot?");
    if (!confirmed) {
      return;
    }

    setError(null);
    try {
      await deleteUniversalAccountMonthlySnapshot(snapshot.id);
      await loadData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete monthly snapshot.");
    }
  }

  const selectedMetrics = detailAccount ? metricsByAccountId[detailAccount.id] ?? null : null;

  return (
    <AppLayout>
      <PageContainer>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <PageHeader
            title="Universal Accounts"
            description="One config-driven engine for all account types with shared analytics and monthly close workflows."
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setAccountModal({ kind: "create" })}>Add Account</Button>
            <Button variant="outline" onClick={() => setSnapshotModal({ kind: "create" })}>Add Monthly Snapshot</Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        <AccountEngineKpiCards summary={summary} />
        <AccountEngineTrendCards summary={summary} />

        <DashboardCard>
          <UniversalAccountFilters
            query={query}
            onQueryChange={setQuery}
            typeFilter={typeFilter}
            onTypeFilterChange={setTypeFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            sortValue={sortValue}
            onSortValueChange={setSortValue}
            accountTypes={accountTypes}
          />
          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">Loading universal accounts...</div>
          ) : (
            <UniversalAccountsTable
              accounts={filteredAccounts}
              metricsByAccountId={metricsByAccountId}
              onView={setDetailAccount}
              onEdit={(account) => setAccountModal({ kind: "edit", account })}
              onDelete={handleDeleteAccount}
            />
          )}
        </DashboardCard>

        <DashboardCard>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Monthly Snapshots</h3>
              <p className="text-sm text-slate-600">Reusable monthly close records across every account type.</p>
            </div>
            <Button variant="outline" onClick={() => setSnapshotModal({ kind: "create" })}>Add Snapshot</Button>
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">Loading snapshots...</div>
          ) : (
            <UniversalMonthlySnapshotsTable
              snapshots={snapshots}
              accounts={accounts}
              onEdit={(snapshot) => setSnapshotModal({ kind: "edit", snapshot })}
              onDelete={handleDeleteSnapshot}
            />
          )}
        </DashboardCard>

        <UniversalAccountDetailDialog
          account={detailAccount}
          metrics={selectedMetrics}
          open={Boolean(detailAccount)}
          onOpenChange={(open) => {
            if (!open) {
              setDetailAccount(null);
            }
          }}
        />

        <Dialog open={Boolean(accountModal)} onOpenChange={(open) => !open && setAccountModal(null)}>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>{accountModal?.kind === "create" ? "Add Universal Account" : `Edit ${accountModal?.account.name ?? "Account"}`}</DialogTitle>
            </DialogHeader>
            {accountModal ? (
              <UniversalAccountForm
                initialData={accountModal.kind === "edit" ? accountModal.account : null}
                onSubmit={handleSaveAccount}
                onCancel={() => setAccountModal(null)}
                submitting={savingAccount}
              />
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(snapshotModal)} onOpenChange={(open) => !open && setSnapshotModal(null)}>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>{snapshotModal?.kind === "create" ? "Add Monthly Snapshot" : "Edit Monthly Snapshot"}</DialogTitle>
            </DialogHeader>
            {snapshotModal ? (
              <UniversalMonthlySnapshotForm
                accounts={accounts}
                initialData={snapshotModal.kind === "edit" ? snapshotModal.snapshot : null}
                onSubmit={handleSaveSnapshot}
                onCancel={() => setSnapshotModal(null)}
                submitting={savingSnapshot}
              />
            ) : null}
          </DialogContent>
        </Dialog>
      </PageContainer>
    </AppLayout>
  );
}
