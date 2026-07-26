"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, CartesianGrid, XAxis, YAxis } from "recharts";
import * as XLSX from "xlsx";

import { MutualFundDetailsDialog } from "@/components/investments/mutualFunds/MutualFundDetailsDialog";
import { MutualFundForm } from "@/components/investments/mutualFunds/MutualFundForm";
import { MutualFundHoldingsTable } from "@/components/investments/mutualFunds/MutualFundHoldingsTable";
import { AppLayout } from "@/components/layout/AppLayout";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { PageBreadcrumb } from "@/components/layout/PageBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageToolbar } from "@/components/layout/PageToolbar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToastViewport } from "@/components/ui/feedback";
import { ModuleCard, ModuleInsightPanel, ModuleKpiGrid, ModuleOnboardingState } from "@/components/ui/module-design-system";
import { formatCurrency } from "@/lib/formatters";
import {
  createInvestment,
  createInvestmentMonthlyHistory,
  deleteInvestment,
  getInvestmentMonthlyHistory,
  getInvestments,
  updateInvestment,
} from "@/services/investments";
import { listMutualFundSchemeMaster } from "@/services/investments/mutualFundSchemeMaster";
import type { Investment, InvestmentInsert, InvestmentMonthlyHistory, InvestmentStatus } from "@/types/investment";

const CHART_COLORS = ["#1d4ed8", "#0f766e", "#f59e0b", "#7c3aed", "#db2777", "#14b8a6", "#64748b"];

type MonthEndFormState = {
  investmentId: string;
  month_end_date: string;
  closing_value: string;
  notes: string;
};

type BulkMonthEndFormState = {
  month_end_date: string;
  nav_price: string;
  notes: string;
};

const defaultMonthEndForm: MonthEndFormState = {
  investmentId: "",
  month_end_date: "",
  closing_value: "",
  notes: "",
};

const defaultBulkMonthEndForm: BulkMonthEndFormState = {
  month_end_date: "",
  nav_price: "",
  notes: "",
};

function endOfMonthIso(dateString: string) {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  const end = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 0));
  return end.toISOString().slice(0, 10);
}

function monthLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(parsed);
}

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}

type ParsedDocumentEntry = {
  type: string;
  fileName: string | null;
  uploadDate: string | null;
  url: string | null;
};

function parseDocumentsPlaceholder(value: string | null | undefined): ParsedDocumentEntry[] {
  if (!value) {
    return [];
  }

  try {
    const decoded = JSON.parse(value) as unknown;
    if (!Array.isArray(decoded)) {
      return [];
    }

    return decoded
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const entry = item as Record<string, unknown>;
        return {
          type: String(entry.type ?? "Statement"),
          fileName: entry.fileName ? String(entry.fileName) : null,
          uploadDate: entry.uploadDate ? String(entry.uploadDate) : null,
          url: entry.url ? String(entry.url) : null,
        };
      })
      .filter((item): item is ParsedDocumentEntry => Boolean(item));
  } catch {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => ({
        type: "Statement",
        fileName: item,
        uploadDate: null,
        url: null,
      }));
  }
}

function downloadWorkbook(fileName: string, rows: Array<Record<string, string | number | null>>) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Holdings");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function duplicateMfKey(values: { owner: string | null | undefined; folioNumber: string | null | undefined; amfiSchemeCode: string | null | undefined }) {
  return `${(values.owner ?? "").trim().toLowerCase()}::${(values.folioNumber ?? "").trim().toLowerCase()}::${(values.amfiSchemeCode ?? "").trim().toLowerCase()}`;
}

export default function MutualFundsPage() {
  const router = useRouter();

  const [allInvestments, setAllInvestments] = useState<Investment[]>([]);
  const [allHistory, setAllHistory] = useState<InvestmentMonthlyHistory[]>([]);
  const [schemeCatalog, setSchemeCatalog] = useState<Array<{
    schemeName: string;
    amc: string | null;
    amfiSchemeCode: string | null;
    investmentMode: "Direct" | "Regular" | null;
    optionType: "Growth" | "IDCW" | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState("");
  const [amcFilter, setAmcFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | InvestmentStatus>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedFund, setSelectedFund] = useState<Investment | null>(null);
  const [editingFund, setEditingFund] = useState<Investment | null>(null);
  const [fundDialogOpen, setFundDialogOpen] = useState(false);

  const [monthEndDialogOpen, setMonthEndDialogOpen] = useState(false);
  const [monthEndForm, setMonthEndForm] = useState<MonthEndFormState>(defaultMonthEndForm);

  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [bulkOwnerDialogOpen, setBulkOwnerDialogOpen] = useState(false);
  const [bulkOwnerValue, setBulkOwnerValue] = useState("");
  const [bulkMonthEndDialogOpen, setBulkMonthEndDialogOpen] = useState(false);
  const [bulkMonthEndForm, setBulkMonthEndForm] = useState<BulkMonthEndFormState>(defaultBulkMonthEndForm);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const mutualFunds = useMemo(
    () => allInvestments.filter((item) => item.investment_type === "Mutual Funds"),
    [allInvestments],
  );

  const mutualFundIds = useMemo(() => new Set(mutualFunds.map((item) => item.id)), [mutualFunds]);

  const mutualFundHistory = useMemo(
    () => allHistory.filter((row) => mutualFundIds.has(row.investment_id)),
    [allHistory, mutualFundIds],
  );

  const selectedFundHistory = useMemo(() => {
    if (!selectedFund) {
      return [];
    }

    return mutualFundHistory.filter((row) => row.investment_id === selectedFund.id);
  }, [mutualFundHistory, selectedFund]);

  const effectiveSelectedRowIds = useMemo(
    () => selectedRowIds.filter((id) => mutualFundIds.has(id)),
    [mutualFundIds, selectedRowIds],
  );

  const selectedFunds = useMemo(() => {
    if (effectiveSelectedRowIds.length === 0) {
      return [];
    }

    const selectedSet = new Set(effectiveSelectedRowIds);
    return mutualFunds.filter((fund) => selectedSet.has(fund.id));
  }, [effectiveSelectedRowIds, mutualFunds]);

  const summary = useMemo(() => {
    const currentMarketValue = mutualFunds.reduce((sum, fund) => sum + Number(fund.current_value ?? 0), 0);
    const investedCost = mutualFunds.reduce((sum, fund) => sum + Number(fund.cost_value ?? fund.cost_basis ?? 0), 0);
    const unrealizedGainLoss = currentMarketValue - investedCost;
    const numberOfSchemes = mutualFunds.length;
    const uniqueAmcs = new Set(mutualFunds.map((fund) => (fund.amc ?? fund.institution ?? "").trim()).filter(Boolean));

    return {
      currentMarketValue,
      investedCost,
      unrealizedGainLoss,
      numberOfSchemes,
      numberOfAmcs: uniqueAmcs.size,
    };
  }, [mutualFunds]);

  const headerSummary = useMemo(() => {
    if (summary.numberOfSchemes === 0) {
      return undefined;
    }

    return `${summary.numberOfSchemes} Holdings across ${summary.numberOfAmcs} AMCs`;
  }, [summary.numberOfAmcs, summary.numberOfSchemes]);

  const amcOptions = useMemo(
    () =>
      Array.from(new Set(mutualFunds.map((fund) => (fund.amc ?? fund.institution ?? "").trim()).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [mutualFunds],
  );

  const ownerOptions = useMemo(
    () => Array.from(new Set(mutualFunds.map((fund) => (fund.owner ?? "").trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right)),
    [mutualFunds],
  );

  const filteredFunds = useMemo(() => {
    const normalized = normalizeQuery(search);

    return mutualFunds.filter((fund) => {
      const matchesSearch =
        normalized.length === 0 || `${fund.investment_name} ${fund.folio_number ?? ""}`.toLowerCase().includes(normalized);
      const amc = (fund.amc ?? fund.institution ?? "").trim();
      const owner = (fund.owner ?? "").trim();
      const matchesAmc = amcFilter === "all" || amc === amcFilter;
      const matchesOwner = ownerFilter === "all" || owner === ownerFilter;
      const matchesStatus = statusFilter === "all" || fund.status === statusFilter;

      return matchesSearch && matchesAmc && matchesOwner && matchesStatus;
    });
  }, [amcFilter, mutualFunds, ownerFilter, search, statusFilter]);

  const paginatedFunds = useMemo(() => filteredFunds.slice((page - 1) * pageSize, page * pageSize), [filteredFunds, page, pageSize]);

  const visibleRowIds = useMemo(() => paginatedFunds.map((fund) => fund.id), [paginatedFunds]);
  const selectedSet = useMemo(() => new Set(effectiveSelectedRowIds), [effectiveSelectedRowIds]);
  const allVisibleSelected = useMemo(
    () => visibleRowIds.length > 0 && visibleRowIds.every((id) => selectedSet.has(id)),
    [selectedSet, visibleRowIds],
  );
  const someVisibleSelected = useMemo(
    () => visibleRowIds.some((id) => selectedSet.has(id)),
    [selectedSet, visibleRowIds],
  );

  const footerCurrentValue = useMemo(() => {
    const baseRows = selectedFunds.length > 0 ? selectedFunds : filteredFunds;
    return baseRows.reduce((sum, row) => sum + Number(row.current_value ?? 0), 0);
  }, [filteredFunds, selectedFunds]);

  const allocationByAmc = useMemo(() => {
    const grouped = mutualFunds.reduce<Record<string, number>>((acc, fund) => {
      const amc = (fund.amc ?? fund.institution ?? "Unspecified").trim() || "Unspecified";
      acc[amc] = (acc[amc] ?? 0) + Number(fund.current_value ?? 0);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0)
      .sort((left, right) => right.value - left.value);
  }, [mutualFunds]);

  const monthlyGrowthSeries = useMemo(() => {
    const grouped = mutualFundHistory.reduce<Record<string, number>>((acc, row) => {
      acc[row.month_end_date] = (acc[row.month_end_date] ?? 0) + Number(row.closing_value ?? 0);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([month_end_date, value]) => ({ month_end_date, label: monthLabel(month_end_date), value }))
      .sort((left, right) => new Date(left.month_end_date).getTime() - new Date(right.month_end_date).getTime())
      .slice(-12);
  }, [mutualFundHistory]);

  async function refresh() {
    try {
      setLoading(true);
      const [investments, history, schemes] = await Promise.all([
        getInvestments(),
        getInvestmentMonthlyHistory(),
        listMutualFundSchemeMaster(),
      ]);
      setAllInvestments(investments);
      setAllHistory(history);
      setSchemeCatalog(
        schemes.map((item) => ({
          schemeName: item.scheme_name,
          amc: item.amc,
          amfiSchemeCode: item.amfi_scheme_code,
          investmentMode: item.investment_mode,
          optionType: item.option_type,
        })),
      );
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load mutual funds.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, []);

  useEffect(() => {
    function handleKeyboardShortcuts(event: KeyboardEvent) {
      if (isEditableElement(event.target)) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        if (visibleRowIds.length === 0) {
          return;
        }

        setSelectedRowIds((current) => {
          const next = new Set(current);
          for (const id of visibleRowIds) {
            next.add(id);
          }
          return Array.from(next);
        });
      }

      if (event.key === "Escape") {
        if (effectiveSelectedRowIds.length === 0) {
          return;
        }

        event.preventDefault();
        setSelectedRowIds([]);
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcuts);
    return () => window.removeEventListener("keydown", handleKeyboardShortcuts);
  }, [effectiveSelectedRowIds.length, visibleRowIds]);

  function toggleRowSelection(rowId: string, checked: boolean) {
    setSelectedRowIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(rowId);
      } else {
        next.delete(rowId);
      }
      return Array.from(next);
    });
  }

  function toggleVisibleSelection(checked: boolean) {
    setSelectedRowIds((current) => {
      const next = new Set(current);
      for (const id of visibleRowIds) {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return Array.from(next);
    });
  }

  function selectAllFiltered() {
    setSelectedRowIds(filteredFunds.map((fund) => fund.id));
  }

  function clearSelection() {
    setSelectedRowIds([]);
  }

  async function handleSaveFund(values: InvestmentInsert) {
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const incomingKey = duplicateMfKey({
        owner: values.owner,
        folioNumber: values.folio_number,
        amfiSchemeCode: values.amfi_scheme_code,
      });

      const hasDuplicate = mutualFunds.some((fund) => {
        if (editingFund && fund.id === editingFund.id) {
          return false;
        }

        return (
          duplicateMfKey({
            owner: fund.owner,
            folioNumber: fund.folio_number,
            amfiSchemeCode: fund.amfi_scheme_code,
          }) === incomingKey
        );
      });

      if (incomingKey !== "::" && hasDuplicate) {
        setError("Duplicate Mutual Fund detected for Owner + Folio Number + AMFI Scheme Code.");
        return;
      }

      if (editingFund) {
        await updateInvestment({ id: editingFund.id, ...values });
        setNotice("Mutual Fund updated successfully.");
      } else {
        await createInvestment(values);
        setNotice("Mutual Fund added successfully.");
      }

      setFundDialogOpen(false);
      setEditingFund(null);
      await refresh();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save mutual fund.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchiveFund(target: Investment) {
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const archiveDate = new Date().toISOString().slice(0, 10);
      const notes = target.notes ? `${target.notes}\nArchived on ${archiveDate}` : `Archived on ${archiveDate}`;

      await updateInvestment({ id: target.id, status: "closed", notes });
      setNotice("Mutual Fund archived.");
      await refresh();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Unable to archive mutual fund.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBulkDelete() {
    if (selectedFunds.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedFunds.length} Mutual Fund Holdings?\n\nThis action cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await Promise.all(selectedFunds.map((fund) => deleteInvestment(fund.id)));
      clearSelection();
      setNotice(`${selectedFunds.length} holding(s) deleted.`);
      await refresh();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete selected holdings.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBulkArchive() {
    const activeSelection = selectedFunds.filter((fund) => fund.status !== "closed");
    if (activeSelection.length === 0) {
      setError("No active holdings selected for archive.");
      return;
    }

    const confirmed = window.confirm(
      `Archive ${activeSelection.length} Holdings?\n\nArchived holdings remain available in reports.`,
    );
    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const archiveDate = new Date().toISOString().slice(0, 10);
      await Promise.all(
        activeSelection.map((fund) => {
          const notes = fund.notes ? `${fund.notes}\nArchived on ${archiveDate}` : `Archived on ${archiveDate}`;
          return updateInvestment({ id: fund.id, status: "closed", notes });
        }),
      );

      clearSelection();
      setNotice(`${activeSelection.length} holding(s) archived.`);
      await refresh();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Unable to archive selected holdings.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleBulkExport() {
    if (selectedFunds.length === 0) {
      return;
    }

    downloadWorkbook(
      `mutual-fund-holdings-${new Date().toISOString().slice(0, 10)}.xlsx`,
      selectedFunds.map((fund) => ({
        "Scheme Name": fund.investment_name,
        AMC: fund.amc ?? fund.institution ?? "",
        "Folio Number": fund.folio_number ?? "",
        Owner: fund.owner ?? "",
        "AMFI Scheme Code": fund.amfi_scheme_code ?? "",
        Units: Number(fund.units ?? 0),
        "NAV Price": Number(fund.nav_price ?? 0),
        "Current Value": Number(fund.current_value ?? 0),
        "Cost Value": Number(fund.cost_value ?? fund.cost_basis ?? 0),
        "Gain Loss": Number(fund.gain_loss ?? 0),
        Status: fund.status,
      })),
    );

    setNotice(`${selectedFunds.length} holding(s) exported.`);
  }

  function openBulkOwnerDialog() {
    if (selectedFunds.length === 0) {
      return;
    }

    setBulkOwnerValue(selectedFunds[0]?.owner ?? "");
    setBulkOwnerDialogOpen(true);
  }

  async function handleBulkOwnerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextOwner = bulkOwnerValue.trim();
    if (!nextOwner || selectedFunds.length === 0) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await Promise.all(selectedFunds.map((fund) => updateInvestment({ id: fund.id, owner: nextOwner })));
      setBulkOwnerDialogOpen(false);
      clearSelection();
      setNotice(`Owner updated for ${selectedFunds.length} holding(s).`);
      await refresh();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (ownerError) {
      setError(ownerError instanceof Error ? ownerError.message : "Unable to update owner for selected holdings.");
    } finally {
      setSubmitting(false);
    }
  }

  function openBulkMonthEndDialog() {
    if (selectedFunds.length === 0) {
      return;
    }

    setBulkMonthEndForm({
      month_end_date: endOfMonthIso(new Date().toISOString()),
      nav_price: "",
      notes: "",
    });
    setBulkMonthEndDialogOpen(true);
  }

  async function handleBulkMonthEndSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedFunds.length === 0 || !bulkMonthEndForm.month_end_date) {
      return;
    }

    const normalizedMonthEndDate = endOfMonthIso(bulkMonthEndForm.month_end_date);
    const navInput = bulkMonthEndForm.nav_price.trim();
    const navValue = navInput.length > 0 ? Number(navInput) : null;
    if (navValue !== null && (!Number.isFinite(navValue) || navValue < 0)) {
      setError("NAV must be a valid positive number.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await Promise.all(
        selectedFunds.map(async (fund) => {
          let closingValue = Number(fund.current_value ?? 0);

          if (navValue !== null) {
            const units = Number(fund.units ?? 0);
            closingValue = Number((units * navValue).toFixed(2));
            await updateInvestment({ id: fund.id, nav_price: navValue });
          }

          await createInvestmentMonthlyHistory({
            investment_id: fund.id,
            month_end_date: normalizedMonthEndDate,
            closing_value: closingValue,
            notes: bulkMonthEndForm.notes.trim() || null,
          });
        }),
      );

      setBulkMonthEndDialogOpen(false);
      clearSelection();
      setNotice(`Month-end values updated for ${selectedFunds.length} holding(s).`);
      await refresh();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (monthEndError) {
      setError(monthEndError instanceof Error ? monthEndError.message : "Unable to update month-end values.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleBulkDownloadStatements() {
    if (selectedFunds.length === 0) {
      return;
    }

    const statementRows: Array<Record<string, string | number | null>> = [];
    const urls: string[] = [];

    for (const fund of selectedFunds) {
      const documents = parseDocumentsPlaceholder(fund.documents_placeholder);
      for (const doc of documents) {
        statementRows.push({
          "Scheme Name": fund.investment_name,
          AMC: fund.amc ?? fund.institution ?? "",
          Owner: fund.owner ?? "",
          "Folio Number": fund.folio_number ?? "",
          "Document Type": doc.type,
          "File Name": doc.fileName ?? "",
          "Upload Date": doc.uploadDate ?? "",
          URL: doc.url ?? "",
        });

        if (doc.url && /^https?:\/\//i.test(doc.url)) {
          urls.push(doc.url);
        }
      }
    }

    if (statementRows.length === 0) {
      setError("No statement metadata available for selected holdings.");
      return;
    }

    downloadWorkbook(
      `mutual-fund-statements-${new Date().toISOString().slice(0, 10)}.xlsx`,
      statementRows,
    );

    for (const url of urls) {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }

    setNotice(`Statement manifest downloaded for ${selectedFunds.length} holding(s).`);
  }

  async function handleSaveMonthEndValue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!monthEndForm.investmentId || !monthEndForm.month_end_date || !monthEndForm.closing_value) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await createInvestmentMonthlyHistory({
        investment_id: monthEndForm.investmentId,
        month_end_date: endOfMonthIso(monthEndForm.month_end_date),
        closing_value: Number(monthEndForm.closing_value),
        notes: monthEndForm.notes.trim() || null,
      });

      setMonthEndDialogOpen(false);
      setMonthEndForm(defaultMonthEndForm);
      setNotice("Month-end value updated.");
      await refresh();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : "Unable to update month-end value.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <PageBreadcrumb items={[{ label: "WealthOS", href: "/dashboard" }, { label: "Investments", href: "/investments" }, { label: "Mutual Funds" }]} />

        <PageToolbar>
          <PageHeader
            title="Mutual Funds"
            description="Manage and monitor your mutual fund portfolio."
            summary={headerSummary}
          />
        </PageToolbar>

        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />
        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />

        {loading ? <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading mutual funds...</div> : null}

        <ModuleKpiGrid>
          <ModuleCard>
            <p className="text-sm font-medium text-slate-500">Current Market Value</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{summary.numberOfSchemes === 0 ? "No Holdings Yet" : formatCurrency(summary.currentMarketValue, { maximumFractionDigits: 0 })}</p>
          </ModuleCard>
          <ModuleCard>
            <p className="text-sm font-medium text-slate-500">Invested Cost</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{summary.numberOfSchemes === 0 ? "No Holdings Yet" : formatCurrency(summary.investedCost, { maximumFractionDigits: 0 })}</p>
          </ModuleCard>
          <ModuleCard>
            <p className="text-sm font-medium text-slate-500">Unrealized Gain / Loss</p>
            <p className={`mt-2 text-2xl font-semibold tracking-tight ${summary.unrealizedGainLoss >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {summary.numberOfSchemes === 0 ? "No Value Change Yet" : formatCurrency(summary.unrealizedGainLoss, { maximumFractionDigits: 0 })}
            </p>
          </ModuleCard>
          <ModuleCard>
            <p className="text-sm font-medium text-slate-500">Number of Schemes</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{summary.numberOfSchemes === 0 ? "No Holdings Yet" : `${summary.numberOfSchemes}`}</p>
          </ModuleCard>
          <ModuleCard>
            <p className="text-sm font-medium text-slate-500">Number of AMCs</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{summary.numberOfSchemes === 0 ? "No Holdings Yet" : `${summary.numberOfAmcs}`}</p>
          </ModuleCard>
        </ModuleKpiGrid>

        <div className="grid gap-4 xl:grid-cols-2">
          <ModuleInsightPanel title="Allocation by AMC" description="Distribution of current market value across AMCs.">
            {allocationByAmc.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Add your first Mutual Fund to view AMC allocation.</div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={allocationByAmc} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95}>
                      {allocationByAmc.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0), { maximumFractionDigits: 0 })} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </ModuleInsightPanel>

          <ModuleInsightPanel title="Monthly Portfolio Growth" description="Month-end value history for the mutual fund portfolio.">
            {monthlyGrowthSeries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Add month-end values to view growth trend.</div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyGrowthSeries}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0), { maximumFractionDigits: 0 })} labelFormatter={(value) => String(value)} />
                    <Line type="monotone" dataKey="value" stroke="#1d4ed8" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </ModuleInsightPanel>
        </div>

        <ContentContainer>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setEditingFund(null);
                setFundDialogOpen(true);
              }}
              disabled={submitting}
            >
              Add Mutual Fund
            </Button>
            <Button variant="outline" onClick={() => router.push("/import-data")} disabled={submitting}>
              Import Mutual Funds
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setMonthEndForm((current) => ({
                  ...current,
                  investmentId: mutualFunds[0]?.id ?? "",
                  month_end_date: endOfMonthIso(new Date().toISOString()),
                }));
                setMonthEndDialogOpen(true);
              }}
              disabled={submitting || mutualFunds.length === 0}
            >
              Update Month-End Values
            </Button>
          </div>
        </ContentContainer>

        {mutualFunds.length === 0 ? (
          <ContentContainer>
            <ModuleOnboardingState
              title="No Holdings Yet"
              description="Add your first Mutual Fund to begin tracking scheme value history and AMC allocation."
              steps={["Add Mutual Fund", "Import Mutual Funds", "Update Month-End Values"]}
            />
          </ContentContainer>
        ) : (
          <MutualFundHoldingsTable
            rows={paginatedFunds}
            totalHoldingsCount={mutualFunds.length}
            filteredRowsCount={filteredFunds.length}
            selectedRowIds={effectiveSelectedRowIds}
            allVisibleSelected={allVisibleSelected}
            someVisibleSelected={someVisibleSelected}
            footerCurrentValue={footerCurrentValue}
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            amcFilter={amcFilter}
            ownerFilter={ownerFilter}
            statusFilter={statusFilter}
            amcOptions={amcOptions}
            ownerOptions={ownerOptions}
            onAmcFilterChange={(value) => {
              setAmcFilter(value);
              setPage(1);
            }}
            onOwnerFilterChange={(value) => {
              setOwnerFilter(value);
              setPage(1);
            }}
            onStatusFilterChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
            page={page}
            pageSize={pageSize}
            totalRows={filteredFunds.length}
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(value);
              setPage(1);
            }}
            onToggleRowSelection={toggleRowSelection}
            onToggleVisibleSelection={toggleVisibleSelection}
            onSelectAllFiltered={selectAllFiltered}
            onClearSelection={clearSelection}
            onBulkEditOwner={openBulkOwnerDialog}
            onBulkArchive={() => {
              void handleBulkArchive();
            }}
            onBulkDelete={() => {
              void handleBulkDelete();
            }}
            onBulkExport={handleBulkExport}
            onBulkMonthEndUpdate={openBulkMonthEndDialog}
            onBulkDownloadStatements={handleBulkDownloadStatements}
            onView={setSelectedFund}
            onEdit={(fund) => {
              setEditingFund(fund);
              setFundDialogOpen(true);
            }}
            onArchive={(fund) => {
              void handleArchiveFund(fund);
            }}
          />
        )}
      </PageContainer>

      <MutualFundDetailsDialog
        fund={selectedFund}
        historyRows={selectedFundHistory}
        open={Boolean(selectedFund)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedFund(null);
          }
        }}
      />

      <Dialog
        open={fundDialogOpen}
        onOpenChange={(open) => {
          setFundDialogOpen(open);
          if (!open) {
            setEditingFund(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingFund ? "Edit Mutual Fund" : "Add Mutual Fund"}</DialogTitle>
          </DialogHeader>
          <MutualFundForm
            initialData={editingFund}
            schemeCatalog={schemeCatalog}
            onSubmit={handleSaveFund}
            onCancel={() => {
              setFundDialogOpen(false);
              setEditingFund(null);
            }}
            submitting={submitting}
            submitLabel={editingFund ? "Save changes" : "Add Mutual Fund"}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkOwnerDialogOpen}
        onOpenChange={(open) => {
          setBulkOwnerDialogOpen(open);
          if (!open) {
            setBulkOwnerValue("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Owner Change</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleBulkOwnerSubmit} className="space-y-3">
            <p className="text-sm text-slate-600">Update owner for {selectedFunds.length} selected holding(s).</p>
            <input
              type="text"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Owner"
              value={bulkOwnerValue}
              onChange={(event) => setBulkOwnerValue(event.target.value)}
              required
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setBulkOwnerDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Update Owner"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkMonthEndDialogOpen}
        onOpenChange={(open) => {
          setBulkMonthEndDialogOpen(open);
          if (!open) {
            setBulkMonthEndForm(defaultBulkMonthEndForm);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Month-End Update</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleBulkMonthEndSubmit} className="space-y-3">
            <p className="text-sm text-slate-600">Apply month-end update to {selectedFunds.length} selected holding(s).</p>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="date"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={bulkMonthEndForm.month_end_date}
                onChange={(event) => setBulkMonthEndForm((current) => ({ ...current, month_end_date: event.target.value }))}
                required
              />
              <input
                type="number"
                step="0.0001"
                min="0"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Optional NAV for all selected holdings"
                value={bulkMonthEndForm.nav_price}
                onChange={(event) => setBulkMonthEndForm((current) => ({ ...current, nav_price: event.target.value }))}
              />
            </div>
            <input
              type="text"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Notes"
              value={bulkMonthEndForm.notes}
              onChange={(event) => setBulkMonthEndForm((current) => ({ ...current, notes: event.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setBulkMonthEndDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Update Month-End Values"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={monthEndDialogOpen}
        onOpenChange={(open) => {
          setMonthEndDialogOpen(open);
          if (!open) {
            setMonthEndForm(defaultMonthEndForm);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Update Month-End Values</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveMonthEndValue} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <select
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={monthEndForm.investmentId}
                onChange={(event) => setMonthEndForm((current) => ({ ...current, investmentId: event.target.value }))}
                required
              >
                <option value="">Select Scheme</option>
                {mutualFunds.map((fund) => (
                  <option key={fund.id} value={fund.id}>{fund.investment_name}</option>
                ))}
              </select>
              <input
                type="date"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={monthEndForm.month_end_date}
                onChange={(event) => setMonthEndForm((current) => ({ ...current, month_end_date: event.target.value }))}
                required
              />
            </div>
            <input
              type="number"
              step="0.01"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Closing Value"
              value={monthEndForm.closing_value}
              onChange={(event) => setMonthEndForm((current) => ({ ...current, closing_value: event.target.value }))}
              required
            />
            <input
              type="text"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Notes"
              value={monthEndForm.notes}
              onChange={(event) => setMonthEndForm((current) => ({ ...current, notes: event.target.value }))}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setMonthEndDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Update Month-End Values"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
