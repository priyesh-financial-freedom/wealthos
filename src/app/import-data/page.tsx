"use client";

import { useMemo, useState } from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { PageBreadcrumb } from "@/components/layout/PageBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageToolbar } from "@/components/layout/PageToolbar";
import { Button } from "@/components/ui/button";
import { DataGrid } from "@/components/ui/data-grid";
import { ToastViewport } from "@/components/ui/feedback";
import { LoadingState } from "@/components/ui/states";
import { buildImportPreview, executeImportPlan, parseWorkbookForImport } from "@/services/imports/excelImport";
import { getSupportedSheetNames } from "@/services/imports/registry";
import {
  downloadEpfImportTemplateWorkbook,
  downloadImportTemplateWorkbook,
  downloadNpsImportTemplateWorkbook,
  downloadPpfImportTemplateWorkbook,
} from "@/services/imports/templateWorkbook";
import type { ImportExecutionSummary, ImportPreview, ParsedWorkbook } from "@/services/imports/types";

function formatIssueLabel(field?: string) {
  return field ? ` (${field})` : "";
}

export default function ImportDataPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedWorkbook, setParsedWorkbook] = useState<ParsedWorkbook | null>(null);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [execution, setExecution] = useState<ImportExecutionSummary | null>(null);

  const [loadingSheets, setLoadingSheets] = useState(false);
  const [validating, setValidating] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [detectedSearch, setDetectedSearch] = useState("");
  const [detectedPage, setDetectedPage] = useState(1);
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewPage, setPreviewPage] = useState(1);
  const [executionSearch, setExecutionSearch] = useState("");
  const [executionPage, setExecutionPage] = useState(1);

  const supportedSheets = useMemo(() => getSupportedSheetNames(), []);

  const hasExecutableRows = useMemo(() => {
    if (!preview) {
      return false;
    }

    return preview.executablePlan.some((item) => item.records.length > 0);
  }, [preview]);

  const validationBySheet = useMemo(() => {
    const map = new Map<string, { validRows: number; errorCount: number; warningCount: number }>();

    if (!preview) {
      return map;
    }

    for (const modulePreview of preview.modules) {
      map.set(modulePreview.sheetName, {
        validRows: modulePreview.validRows,
        errorCount: modulePreview.errorCount,
        warningCount: modulePreview.warningCount,
      });
    }

    return map;
  }, [preview]);

  const selectedDetectedSheets = useMemo(() => {
    if (!parsedWorkbook) {
      return [];
    }

    const selected = new Set(selectedSheets);
    return parsedWorkbook.detectedSheets.filter((sheet) => selected.has(sheet.sheetName));
  }, [parsedWorkbook, selectedSheets]);

  const estimatedSelectedRows = useMemo(
    () => selectedDetectedSheets.reduce((sum, sheet) => sum + sheet.rows.length, 0),
    [selectedDetectedSheets],
  );

  const estimatedValidatedRecords = useMemo(
    () => preview?.modules.reduce((sum, modulePreview) => sum + modulePreview.validRows, 0) ?? 0,
    [preview],
  );

  const detectedRows = useMemo(() => {
    if (!parsedWorkbook) {
      return [] as Array<{ importable: boolean; sheetName: string; module: string; rows: number; validationStatus: string }>;
    }

    const normalizedQuery = detectedSearch.trim().toLowerCase();

    return parsedWorkbook.detectedSheets
      .map((sheet) => {
        const status = !selectedSheets.includes(sheet.sheetName)
          ? "Not selected"
          : (() => {
              const validation = validationBySheet.get(sheet.sheetName);
              if (!validation) {
                return "Pending validation";
              }
              if (validation.errorCount > 0) {
                return `Errors (${validation.errorCount})`;
              }
              if (validation.warningCount > 0) {
                return `Warnings (${validation.warningCount})`;
              }
              return "Ready";
            })();

        return {
          importable: selectedSheets.includes(sheet.sheetName),
          sheetName: sheet.sheetName,
          module: sheet.plugin.displayName,
          rows: sheet.rows.length,
          validationStatus: status,
        };
      })
      .filter((row) => !normalizedQuery || `${row.sheetName} ${row.module} ${row.validationStatus}`.toLowerCase().includes(normalizedQuery));
  }, [detectedSearch, parsedWorkbook, selectedSheets, validationBySheet]);

  const previewRows = useMemo(() => {
    const normalizedQuery = previewSearch.trim().toLowerCase();
    return (preview?.modules ?? []).filter((item) => !normalizedQuery || `${item.displayName} ${item.sheetName}`.toLowerCase().includes(normalizedQuery));
  }, [preview, previewSearch]);

  const executionRows = useMemo(() => {
    const normalizedQuery = executionSearch.trim().toLowerCase();
    return (execution?.modules ?? []).filter((item) => !normalizedQuery || `${item.displayName} ${item.sheetName}`.toLowerCase().includes(normalizedQuery));
  }, [execution, executionSearch]);

  const paginatedDetectedRows = useMemo(() => detectedRows.slice((detectedPage - 1) * 10, detectedPage * 10), [detectedPage, detectedRows]);
  const paginatedPreviewRows = useMemo(() => previewRows.slice((previewPage - 1) * 10, previewPage * 10), [previewPage, previewRows]);
  const paginatedExecutionRows = useMemo(() => executionRows.slice((executionPage - 1) * 10, executionPage * 10), [executionPage, executionRows]);

  async function handleWorkbookSelection(nextFile: File | null) {
    setFile(nextFile);
    setParsedWorkbook(null);
    setSelectedSheets([]);
    setPreview(null);
    setExecution(null);
    setError(null);
    setNotice(null);

    if (!nextFile) {
      return;
    }

    setLoadingSheets(true);

    try {
      const parsed = await parseWorkbookForImport(nextFile);
      const detectedSheetNames = parsed.detectedSheets.map((sheet) => sheet.sheetName);

      setParsedWorkbook(parsed);
      setSelectedSheets(detectedSheetNames);

      if (parsed.detectedSheets.length === 0) {
        setNotice(
          parsed.referenceSheets.length > 0
            ? `Detected ${parsed.referenceSheets.length} reference sheet(s). No importable sheets found.`
            : "No supported sheets were found in this workbook.",
        );
      } else {
        setNotice(
          `Detected ${parsed.detectedSheets.length} importable sheet(s)` +
            (parsed.referenceSheets.length > 0 ? ` and ${parsed.referenceSheets.length} reference sheet(s).` : ".") +
            " Select sheets and run validation.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to parse workbook.");
    } finally {
      setLoadingSheets(false);
    }
  }

  async function handleValidateSelectedSheets() {
    if (!parsedWorkbook) {
      setError("Select a workbook first.");
      return;
    }

    if (selectedSheets.length === 0) {
      setError("Select at least one sheet to validate.");
      return;
    }

    setValidating(true);
    setError(null);
    setNotice(null);
    setExecution(null);

    try {
      const selected = new Set(selectedSheets);
      const filteredWorkbook: ParsedWorkbook = {
        ...parsedWorkbook,
        detectedSheets: parsedWorkbook.detectedSheets.filter((sheet) => selected.has(sheet.sheetName)),
      };

      const nextPreview = await buildImportPreview(filteredWorkbook);
      setPreview(nextPreview);
      setNotice("Validation completed for selected sheets.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to validate selected sheets.");
    } finally {
      setValidating(false);
    }
  }

  async function handleExecute() {
    if (!preview) {
      setError("Analyze the workbook before importing.");
      return;
    }

    setExecuting(true);
    setError(null);
    setNotice(null);

    try {
      const summary = await executeImportPlan(preview.executablePlan);
      setExecution(summary);

      if (summary.totals.failed > 0) {
        const firstIssue = summary.issues[0]?.message;
        throw new Error(firstIssue ? `Import failed for ${summary.totals.failed} row(s): ${firstIssue}` : `Import failed for ${summary.totals.failed} row(s).`);
      }

      setNotice(`Import completed. Inserted ${summary.totals.inserted} row(s), updated ${summary.totals.updated} row(s).`);

      if (summary.totals.inserted > 0 || summary.totals.updated > 0) {
        window.dispatchEvent(new Event("wealthos:finance-data-updated"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setExecuting(false);
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <PageBreadcrumb items={[{ label: "WealthOS", href: "/dashboard" }, { label: "Import Wizard" }]} />
        <PageHeader
          title="Import Data"
          description="Upload an .xlsx workbook and run module-based import plugins. The wizard orchestrates parsing, validation, preview, and execution."
        />

        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />
        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />

        <ContentContainer>
          <div className="space-y-4">
            <PageToolbar>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Step 1: Upload Workbook</h2>
                <p className="text-sm text-slate-600">Supported sheets: {supportedSheets.join(", ")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={downloadImportTemplateWorkbook} disabled={loadingSheets || validating || executing}>
                  Download Full Template
                </Button>
                <Button type="button" variant="outline" onClick={downloadPpfImportTemplateWorkbook} disabled={loadingSheets || validating || executing}>
                  PPF Template
                </Button>
                <Button type="button" variant="outline" onClick={downloadEpfImportTemplateWorkbook} disabled={loadingSheets || validating || executing}>
                  EPF Template
                </Button>
                <Button type="button" variant="outline" onClick={downloadNpsImportTemplateWorkbook} disabled={loadingSheets || validating || executing}>
                  NPS Template
                </Button>
              </div>
            </PageToolbar>

            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                void handleWorkbookSelection(selected);
              }}
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />

            {file ? <p className="text-sm text-slate-600">Selected file: {file.name}</p> : null}

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={handleValidateSelectedSheets}
                disabled={!parsedWorkbook || selectedSheets.length === 0 || loadingSheets || validating || executing}
              >
                {validating ? "Validating..." : "Validate Selected Sheets"}
              </Button>
              <p className="self-center text-sm text-slate-600">
                Estimated selected rows: {estimatedSelectedRows}
                {preview ? ` | Estimated valid records: ${estimatedValidatedRecords}` : ""}
              </p>
            </div>
          </div>
        </ContentContainer>

        {loadingSheets ? <LoadingState label="Detecting worksheets in workbook..." /> : null}
        {validating ? <LoadingState label="Validating selected sheets..." /> : null}

        {parsedWorkbook ? (
          <ContentContainer>
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-slate-900">Step 2: Detected Sheets</h2>
              <p className="text-sm text-slate-600">Workbook: {parsedWorkbook.fileName}</p>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedSheets(parsedWorkbook.detectedSheets.map((sheet) => sheet.sheetName));
                    setPreview(null);
                    setExecution(null);
                  }}
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedSheets([]);
                    setPreview(null);
                    setExecution(null);
                  }}
                >
                  Select None
                </Button>
              </div>

              <DataGrid
                title="Detected sheets"
                description="Select which importable sheets should move into validation."
                columns={[
                  {
                    key: "import",
                    header: "Import",
                    widthClassName: "min-w-24",
                    cell: (row) => (
                      <input
                        type="checkbox"
                        checked={row.importable}
                        onChange={() => {
                          setSelectedSheets((current) => {
                            const next = current.includes(row.sheetName)
                              ? current.filter((name) => name !== row.sheetName)
                              : [...current, row.sheetName];
                            return next;
                          });
                          setPreview(null);
                          setExecution(null);
                        }}
                      />
                    ),
                  },
                  { key: "sheet", header: "Sheet", widthClassName: "min-w-48", cell: (row) => row.sheetName },
                  { key: "module", header: "Module", widthClassName: "min-w-40", cell: (row) => row.module },
                  { key: "rows", header: "Rows", widthClassName: "min-w-24", cell: (row) => row.rows },
                  { key: "status", header: "Validation Status", widthClassName: "min-w-40", cell: (row) => row.validationStatus },
                ]}
                rows={paginatedDetectedRows}
                getRowId={(row) => row.sheetName}
                search={{ value: detectedSearch, onChange: setDetectedSearch, placeholder: "Search detected sheets" }}
                pagination={{ page: detectedPage, pageSize: 10, totalRows: detectedRows.length, onPageChange: setDetectedPage }}
                emptyTitle="No importable sheets found"
                emptyDescription="This workbook does not contain any supported import sheets."
              />

              {parsedWorkbook.detectedSheets.some((sheet) => sheet.columnMapping.length > 0) ? (
                <div className="space-y-3 pt-2">
                  <h3 className="text-sm font-semibold text-slate-800">Detected Column Mapping (before validation)</h3>
                  {parsedWorkbook.detectedSheets
                    .filter((sheet) => sheet.columnMapping.length > 0)
                    .map((sheet) => (
                      <div key={`${sheet.sheetName}:mapping`} className="space-y-2">
                        <p className="text-sm font-medium text-slate-700">{sheet.sheetName}</p>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 text-left text-slate-600">
                                <th className="px-2 py-2">Workbook Column</th>
                                <th className="px-2 py-2">WealthOS Field</th>
                                <th className="px-2 py-2">Required</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sheet.columnMapping.map((item) => (
                                <tr key={`${sheet.sheetName}:${item.field}`} className="border-b border-slate-100">
                                  <td className="px-2 py-2">{item.workbookColumn ?? "Not Detected"}</td>
                                  <td className="px-2 py-2">{item.field}</td>
                                  <td className="px-2 py-2">{item.required ? "Yes" : "No"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                </div>
              ) : null}

              {parsedWorkbook.referenceSheets.length > 0 ? (
                <div className="space-y-2 pt-2">
                  <h3 className="text-sm font-semibold text-slate-800">Reference / Calculation Sheets</h3>
                  <DataGrid
                    title="Reference sheets"
                    columns={[
                      { key: "sheet", header: "Sheet", widthClassName: "min-w-48", cell: (row) => row.sheetName },
                      { key: "label", header: "Module", widthClassName: "min-w-32", cell: (row) => row.label },
                      { key: "rows", header: "Rows", widthClassName: "min-w-24", cell: (row) => row.rowCount },
                      { key: "status", header: "Status", widthClassName: "min-w-28", cell: () => "Not importable" },
                    ]}
                    rows={parsedWorkbook.referenceSheets}
                    getRowId={(row) => row.sheetName}
                    emptyTitle="No reference sheets"
                    emptyDescription="No reference or calculation sheets were detected."
                    maxBodyHeightClassName="max-h-[24rem]"
                  />
                </div>
              ) : null}

              {parsedWorkbook.ignoredSheets.length > 0 ? (
                <p className="text-sm text-amber-700">Ignored sheets: {parsedWorkbook.ignoredSheets.join(", ")}</p>
              ) : null}
              <p className="text-sm text-slate-600">
                Selected importable sheets: {selectedSheets.length} of {parsedWorkbook.detectedSheets.length}
              </p>
            </div>
          </ContentContainer>
        ) : null}

        {preview ? (
          <ContentContainer>
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-slate-900">Step 3: Validation Preview</h2>

              <DataGrid
                title="Validation preview"
                columns={[
                  { key: "module", header: "Module", widthClassName: "min-w-40", cell: (row) => row.displayName },
                  { key: "sheet", header: "Sheet", widthClassName: "min-w-40", cell: (row) => row.sheetName },
                  { key: "rows", header: "Rows", widthClassName: "min-w-20", cell: (row) => row.totalRows },
                  { key: "valid", header: "Valid", widthClassName: "min-w-20", cell: (row) => row.validRows },
                  { key: "errors", header: "Errors", widthClassName: "min-w-20", cell: (row) => row.errorCount },
                  { key: "warnings", header: "Warnings", widthClassName: "min-w-24", cell: (row) => row.warningCount },
                ]}
                rows={paginatedPreviewRows}
                getRowId={(row) => `${row.moduleId}:${row.sheetName}`}
                search={{ value: previewSearch, onChange: setPreviewSearch, placeholder: "Search validation results" }}
                pagination={{ page: previewPage, pageSize: 10, totalRows: previewRows.length, onPageChange: setPreviewPage }}
                emptyTitle="No validation results"
                emptyDescription="Run validation on the selected sheets to populate this preview."
                maxBodyHeightClassName="max-h-[28rem]"
              />

              {preview.issues.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-800">Validation issues (first 50)</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {preview.issues.slice(0, 50).map((item, index) => (
                      <li key={`${item.sheetName}:${item.rowNumber}:${item.field}:${index}`}>
                        [{item.severity.toUpperCase()}] {item.sheetName} row {item.rowNumber}
                        {formatIssueLabel(item.field)}: {item.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-emerald-700">No validation issues found.</p>
              )}

              <div className="flex flex-wrap gap-3">
                <Button type="button" onClick={handleExecute} disabled={!hasExecutableRows || executing || validating || loadingSheets}>
                  {executing ? "Importing..." : "Execute Import"}
                </Button>
              </div>
            </div>
          </ContentContainer>
        ) : null}

        {executing ? <LoadingState label="Importing validated rows..." /> : null}

        {execution ? (
          <ContentContainer>
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-slate-900">Step 4: Execution Summary</h2>
              <p className="text-sm text-slate-700">
                Inserted: {execution.totals.inserted} | Updated: {execution.totals.updated} | Failed: {execution.totals.failed}
              </p>

              <DataGrid
                title="Execution summary"
                columns={[
                  { key: "module", header: "Module", widthClassName: "min-w-40", cell: (row) => row.displayName },
                  { key: "sheet", header: "Sheet", widthClassName: "min-w-40", cell: (row) => row.sheetName },
                  { key: "inserted", header: "Inserted", widthClassName: "min-w-24", cell: (row) => row.inserted },
                  { key: "updated", header: "Updated", widthClassName: "min-w-24", cell: (row) => row.updated },
                  { key: "failed", header: "Failed", widthClassName: "min-w-20", cell: (row) => row.failed },
                ]}
                rows={paginatedExecutionRows}
                getRowId={(row) => `${row.moduleId}:${row.sheetName}`}
                search={{ value: executionSearch, onChange: setExecutionSearch, placeholder: "Search execution summary" }}
                pagination={{ page: executionPage, pageSize: 10, totalRows: executionRows.length, onPageChange: setExecutionPage }}
                emptyTitle="No execution results"
                emptyDescription="Execute a validated import plan to populate this summary."
                maxBodyHeightClassName="max-h-[28rem]"
              />

              {execution.issues.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-rose-700">
                  {execution.issues.slice(0, 50).map((item, index) => (
                    <li key={`${item.sheetName}:${item.rowNumber}:${item.field}:${index}`}>
                      {item.sheetName} row {item.rowNumber}
                      {formatIssueLabel(item.field)}: {item.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </ContentContainer>
        ) : null}
      </PageContainer>
    </AppLayout>
  );
}
