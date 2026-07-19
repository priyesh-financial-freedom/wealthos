import * as XLSX from "xlsx";

import { classifySheetForImport } from "@/services/imports/registry";
import type {
  ImportIssue,
  ImportExecutionSummary,
  ImportExecutionSummaryItem,
  ModulePreview,
  ImportPreview,
  ImportPreviewPlanItem,
  ParsedWorkbook,
  ParsedWorkbookSheet,
} from "@/services/imports/types";

function readWorkbook(file: File) {
  return new Promise<XLSX.WorkBook>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: "array" });
        resolve(workbook);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file."));
    reader.readAsArrayBuffer(file);
  });
}

function parseSheetRows(workbook: XLSX.WorkBook, sheetName: string) {
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    return [];
  }

  return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    raw: true,
    defval: null,
    blankrows: false,
  });
}

export async function parseWorkbookForImport(file: File): Promise<ParsedWorkbook> {
  const workbook = await readWorkbook(file);
  const detectedSheets: ParsedWorkbookSheet[] = [];
  const referenceSheets: ParsedWorkbook["referenceSheets"] = [];
  const ignoredSheets: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const classification = classifySheetForImport(sheetName);

    if (classification.kind === "ignored") {
      ignoredSheets.push(sheetName);
      continue;
    }

    const rows = parseSheetRows(workbook, sheetName);

    if (classification.kind === "reference") {
      referenceSheets.push({
        sheetName,
        rowCount: rows.length,
        label: classification.label,
      });
      continue;
    }

    detectedSheets.push({
      sheetName,
      plugin: classification.plugin,
      rows,
      columnMapping: classification.plugin.getColumnMapping?.(sheetName, rows) ?? [],
    });
  }

  return {
    fileName: file.name,
    detectedSheets,
    referenceSheets,
    ignoredSheets,
  };
}

export async function buildImportPreview(parsedWorkbook: ParsedWorkbook): Promise<ImportPreview> {
  const modules: ModulePreview[] = [];
  const issues: ImportIssue[] = [];
  const executablePlan: ImportPreviewPlanItem[] = [];

  for (const sheet of parsedWorkbook.detectedSheets) {
    const validation = await sheet.plugin.validateRows(sheet.sheetName, sheet.rows);
    const errorCount = validation.issues.filter((item) => item.severity === "error").length;
    const warningCount = validation.issues.filter((item) => item.severity === "warning").length;

    modules.push({
      moduleId: sheet.plugin.moduleId,
      displayName: sheet.plugin.displayName,
      sheetName: sheet.sheetName,
      totalRows: validation.totalRows,
      validRows: validation.records.length,
      errorCount,
      warningCount,
    });

    executablePlan.push({
      plugin: sheet.plugin,
      sheetName: sheet.sheetName,
      records: validation.records,
    });

    issues.push(...validation.issues);
  }

  return {
    fileName: parsedWorkbook.fileName,
    ignoredSheets: parsedWorkbook.ignoredSheets,
    modules,
    issues,
    executablePlan,
  };
}

export async function executeImportPlan(plan: ImportPreviewPlanItem[]): Promise<ImportExecutionSummary> {
  const modules: ImportExecutionSummaryItem[] = [];
  const issues: ImportIssue[] = [];

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  console.info("[imports] executeImportPlan:start", {
    modules: plan.map((item) => ({ moduleId: item.plugin.moduleId, sheetName: item.sheetName, records: item.records.length })),
  });

  for (const item of plan) {
    console.info("[imports] module:execute:start", {
      moduleId: item.plugin.moduleId,
      sheetName: item.sheetName,
      records: item.records.length,
    });

    const execution = await item.plugin.executeRows(item.sheetName, item.records);

    console.info("[imports] module:execute:done", {
      moduleId: item.plugin.moduleId,
      sheetName: item.sheetName,
      inserted: execution.inserted,
      updated: execution.updated,
      failed: execution.failed,
      issues: execution.issues.length,
    });

    inserted += execution.inserted;
    updated += execution.updated;
    failed += execution.failed;
    issues.push(...execution.issues);

    modules.push({
      moduleId: item.plugin.moduleId,
      displayName: item.plugin.displayName,
      sheetName: item.sheetName,
      inserted: execution.inserted,
      updated: execution.updated,
      failed: execution.failed,
    });
  }

  const summary: ImportExecutionSummary = {
    modules,
    issues,
    totals: {
      inserted,
      updated,
      failed,
    },
  };

  console.info("[imports] executeImportPlan:done", {
    inserted: summary.totals.inserted,
    updated: summary.totals.updated,
    failed: summary.totals.failed,
    issues: summary.issues.length,
  });

  return summary;
}
