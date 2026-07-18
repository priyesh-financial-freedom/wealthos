export type ImportIssueSeverity = "error" | "warning";

export interface ImportIssue {
  severity: ImportIssueSeverity;
  sheetName: string;
  rowNumber: number;
  field?: string;
  message: string;
}

export type ImportRawRow = Record<string, unknown>;

export interface ImportColumnMappingEntry {
  field: string;
  workbookColumn: string | null;
  required: boolean;
}

export interface ImportValidatedRecord<TPayload = unknown> {
  rowNumber: number;
  action: "create" | "update";
  payload: TPayload;
}

export interface ImportValidationResult<TPayload = unknown> {
  records: Array<ImportValidatedRecord<TPayload>>;
  issues: ImportIssue[];
  totalRows: number;
}

export interface ImportExecutionResult {
  inserted: number;
  updated: number;
  failed: number;
  issues: ImportIssue[];
}

export interface ImportModulePlugin<TPayload = unknown> {
  moduleId: string;
  displayName: string;
  supportedSheets: string[];
  getColumnMapping?(sheetName: string, rows: ImportRawRow[]): ImportColumnMappingEntry[];
  validateRows(sheetName: string, rows: ImportRawRow[]): Promise<ImportValidationResult<TPayload>>;
  executeRows(sheetName: string, records: Array<ImportValidatedRecord<TPayload>>): Promise<ImportExecutionResult>;
}

export interface ParsedWorkbookSheet {
  sheetName: string;
  plugin: ImportModulePlugin;
  rows: ImportRawRow[];
  columnMapping: ImportColumnMappingEntry[];
}

export interface ParsedWorkbookReferenceSheet {
  sheetName: string;
  rowCount: number;
  label: string;
}

export interface ParsedWorkbook {
  fileName: string;
  detectedSheets: ParsedWorkbookSheet[];
  referenceSheets: ParsedWorkbookReferenceSheet[];
  ignoredSheets: string[];
}

export interface ModulePreview {
  moduleId: string;
  displayName: string;
  sheetName: string;
  totalRows: number;
  validRows: number;
  errorCount: number;
  warningCount: number;
}

export interface ImportExecutionSummaryItem {
  moduleId: string;
  displayName: string;
  sheetName: string;
  inserted: number;
  updated: number;
  failed: number;
}

export interface ImportPreviewPlanItem {
  plugin: ImportModulePlugin;
  sheetName: string;
  records: ImportValidatedRecord[];
}

export interface ImportPreview {
  fileName: string;
  ignoredSheets: string[];
  modules: ModulePreview[];
  issues: ImportIssue[];
  executablePlan: ImportPreviewPlanItem[];
}

export interface ImportExecutionSummary {
  modules: ImportExecutionSummaryItem[];
  issues: ImportIssue[];
  totals: {
    inserted: number;
    updated: number;
    failed: number;
  };
}
