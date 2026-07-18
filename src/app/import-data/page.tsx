"use client";

import { useMemo, useState } from "react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { LoadingSpinner, ToastViewport } from "@/components/ui/feedback";
import { buildImportPreview, executeImportPlan, parseWorkbookForImport } from "@/services/imports/excelImport";
import { getSupportedSheetNames } from "@/services/imports/registry";
import { downloadImportTemplateWorkbook } from "@/services/imports/templateWorkbook";
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
      setNotice("Import completed.");

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
        <PageHeader
          title="Import Data"
          description="Upload an .xlsx workbook and run module-based import plugins. The wizard orchestrates parsing, validation, preview, and execution."
        />

        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />
        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />

        <DashboardCard>
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Step 1: Upload Workbook</h2>
              <p className="text-sm text-slate-600">Supported sheets: {supportedSheets.join(", ")}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={downloadImportTemplateWorkbook} disabled={loadingSheets || validating || executing}>
                Download Template
              </Button>
            </div>

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
        </DashboardCard>

        {loadingSheets ? <LoadingSpinner label="Detecting worksheets in workbook..." /> : null}
        {validating ? <LoadingSpinner label="Validating selected sheets..." /> : null}

        {parsedWorkbook ? (
          <DashboardCard>
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

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-600">
                      <th className="px-2 py-2">Import</th>
                      <th className="px-2 py-2">Sheet</th>
                      <th className="px-2 py-2">Module</th>
                      <th className="px-2 py-2">Rows</th>
                      <th className="px-2 py-2">Validation Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedWorkbook.detectedSheets.map((sheet) => (
                      <tr key={sheet.sheetName} className="border-b border-slate-100">
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={selectedSheets.includes(sheet.sheetName)}
                            onChange={() => {
                              setSelectedSheets((current) => {
                                const next = current.includes(sheet.sheetName)
                                  ? current.filter((name) => name !== sheet.sheetName)
                                  : [...current, sheet.sheetName];
                                return next;
                              });
                              setPreview(null);
                              setExecution(null);
                            }}
                          />
                        </td>
                        <td className="px-2 py-2">{sheet.sheetName}</td>
                        <td className="px-2 py-2">{sheet.plugin.displayName}</td>
                        <td className="px-2 py-2">{sheet.rows.length}</td>
                        <td className="px-2 py-2">
                          {(() => {
                            if (!selectedSheets.includes(sheet.sheetName)) {
                              return "Not selected";
                            }

                            const status = validationBySheet.get(sheet.sheetName);
                            if (!status) {
                              return "Pending validation";
                            }

                            if (status.errorCount > 0) {
                              return `Errors (${status.errorCount})`;
                            }

                            if (status.warningCount > 0) {
                              return `Warnings (${status.warningCount})`;
                            }

                            return "Ready";
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

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
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-slate-600">
                          <th className="px-2 py-2">Sheet</th>
                          <th className="px-2 py-2">Module</th>
                          <th className="px-2 py-2">Rows</th>
                          <th className="px-2 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedWorkbook.referenceSheets.map((sheet) => (
                          <tr key={sheet.sheetName} className="border-b border-slate-100">
                            <td className="px-2 py-2">{sheet.sheetName}</td>
                            <td className="px-2 py-2">{sheet.label}</td>
                            <td className="px-2 py-2">{sheet.rowCount}</td>
                            <td className="px-2 py-2">Not importable</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {parsedWorkbook.ignoredSheets.length > 0 ? (
                <p className="text-sm text-amber-700">Ignored sheets: {parsedWorkbook.ignoredSheets.join(", ")}</p>
              ) : null}
              <p className="text-sm text-slate-600">
                Selected importable sheets: {selectedSheets.length} of {parsedWorkbook.detectedSheets.length}
              </p>
            </div>
          </DashboardCard>
        ) : null}

        {preview ? (
          <DashboardCard>
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-slate-900">Step 3: Validation Preview</h2>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-600">
                      <th className="px-2 py-2">Module</th>
                      <th className="px-2 py-2">Sheet</th>
                      <th className="px-2 py-2">Rows</th>
                      <th className="px-2 py-2">Valid</th>
                      <th className="px-2 py-2">Errors</th>
                      <th className="px-2 py-2">Warnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.modules.map((modulePreview) => (
                      <tr key={`${modulePreview.moduleId}:${modulePreview.sheetName}`} className="border-b border-slate-100">
                        <td className="px-2 py-2">{modulePreview.displayName}</td>
                        <td className="px-2 py-2">{modulePreview.sheetName}</td>
                        <td className="px-2 py-2">{modulePreview.totalRows}</td>
                        <td className="px-2 py-2">{modulePreview.validRows}</td>
                        <td className="px-2 py-2">{modulePreview.errorCount}</td>
                        <td className="px-2 py-2">{modulePreview.warningCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

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
          </DashboardCard>
        ) : null}

        {executing ? <LoadingSpinner label="Importing validated rows..." /> : null}

        {execution ? (
          <DashboardCard>
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-slate-900">Step 4: Execution Summary</h2>
              <p className="text-sm text-slate-700">
                Inserted: {execution.totals.inserted} | Updated: {execution.totals.updated} | Failed: {execution.totals.failed}
              </p>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-600">
                      <th className="px-2 py-2">Module</th>
                      <th className="px-2 py-2">Sheet</th>
                      <th className="px-2 py-2">Inserted</th>
                      <th className="px-2 py-2">Updated</th>
                      <th className="px-2 py-2">Failed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {execution.modules.map((item) => (
                      <tr key={`${item.moduleId}:${item.sheetName}`} className="border-b border-slate-100">
                        <td className="px-2 py-2">{item.displayName}</td>
                        <td className="px-2 py-2">{item.sheetName}</td>
                        <td className="px-2 py-2">{item.inserted}</td>
                        <td className="px-2 py-2">{item.updated}</td>
                        <td className="px-2 py-2">{item.failed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

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
          </DashboardCard>
        ) : null}
      </PageContainer>
    </AppLayout>
  );
}
