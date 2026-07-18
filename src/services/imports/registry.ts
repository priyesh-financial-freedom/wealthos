import type { ImportModulePlugin } from "@/services/imports/types";
import { normalizeSheetName } from "@/services/imports/utils";
import { bankAccountsImportPlugin } from "@/services/imports/plugins/bankAccountsImport";
import { investmentsImportPlugin } from "@/services/imports/plugins/investmentsImport";
import { liabilitiesImportPlugin } from "@/services/imports/plugins/liabilitiesImport";
import { retirementImportPlugin } from "@/services/imports/plugins/retirementImport";
import { fixedDepositsImportPlugin } from "@/services/imports/plugins/fixedDepositsImport";
import { goldImportPlugin } from "@/services/imports/plugins/goldImport";
import { silverImportPlugin } from "@/services/imports/plugins/silverImport";
import { insuranceImportPlugin } from "@/services/imports/plugins/insuranceImport";

export const importModulePlugins: ImportModulePlugin[] = [
  bankAccountsImportPlugin,
  investmentsImportPlugin,
  liabilitiesImportPlugin,
  retirementImportPlugin,
  insuranceImportPlugin,
  fixedDepositsImportPlugin,
  goldImportPlugin,
  silverImportPlugin,
];

const sheetLookup = importModulePlugins.reduce<Map<string, ImportModulePlugin>>((acc, plugin) => {
  for (const sheet of plugin.supportedSheets) {
    acc.set(normalizeSheetName(sheet), plugin);
  }
  return acc;
}, new Map());

const referenceSheetTokens = ["dashboard", "calculation", "calculations", "query", "queries", "helper", "helpers", "actuals", "logs"];

const referenceSheetNames = [
  "AMFI NAV Data",
  "EPF Annual Interest Model",
  "EPF Annual Summary",
  "Bank Balances Monthly",
  "Bank Monthly Summary",
  "Loan Amortization",
  "Live Price Setup",
  "Dashboard",
  "Monthly Engine",
  "Queries",
  "Actuals Dashboard",
  "Funding Review",
  "Logs",
];

const referenceLookup = new Set(referenceSheetNames.map((name) => normalizeSheetName(name)));

const aliasLookup = new Map<string, ImportModulePlugin>();

function registerAliases(plugin: ImportModulePlugin, aliases: string[]) {
  for (const alias of aliases) {
    aliasLookup.set(normalizeSheetName(alias), plugin);
  }
}

registerAliases(bankAccountsImportPlugin, [
  "Bank Accounts",
  "Bank Account",
  "Banking",
  "Cash and Bank",
  "Cash & Bank",
  "PFP Bank Accounts",
  "Priyesh Bank Accounts",
]);

registerAliases(investmentsImportPlugin, [
  "Investments",
  "Investment",
  "MF Holdings",
  "Stock Holdings",
  "PFP Investments",
  "Priyesh Investments",
  "MF and Stocks",
]);

registerAliases(liabilitiesImportPlugin, [
  "Liabilities",
  "Liability",
  "Loan Inputs",
  "Loans",
  "Debts",
  "PFP Liabilities",
  "Priyesh Liabilities",
]);

registerAliases(retirementImportPlugin, [
  "Retirement",
  "Retirement Accounts",
  "PPF Accounts",
  "EPF PPF NPS",
  "PFP Retirement",
  "Priyesh Retirement",
]);

registerAliases(insuranceImportPlugin, ["Health Insurance", "Life Insurance", "Insurance"]);

registerAliases(fixedDepositsImportPlugin, [
  "Fixed Deposits",
  "Fixed Deposit",
  "FD",
  "FD and RD",
  "FD RD",
  "PFP Fixed Deposits",
  "Priyesh Fixed Deposits",
]);

registerAliases(goldImportPlugin, [
  "Gold",
  "Gold Holdings",
  "PFP Gold",
  "Priyesh Gold",
]);

registerAliases(silverImportPlugin, [
  "Silver",
  "Silver Holdings",
  "PFP Silver",
  "Priyesh Silver",
]);

function isReferenceSheet(sheetName: string) {
  const normalized = normalizeSheetName(sheetName);
  if (referenceLookup.has(normalized)) {
    return true;
  }

  return referenceSheetTokens.some((token) => normalized.includes(normalizeSheetName(token)));
}

export type SheetClassification =
  | { kind: "importable"; plugin: ImportModulePlugin }
  | { kind: "reference"; label: "Reference Sheet" }
  | { kind: "ignored" };

export function classifySheetForImport(sheetName: string): SheetClassification {
  const normalized = normalizeSheetName(sheetName);

  const direct = sheetLookup.get(normalized);
  if (direct) {
    return { kind: "importable", plugin: direct };
  }

  const aliased = aliasLookup.get(normalized);
  if (aliased) {
    return { kind: "importable", plugin: aliased };
  }

  if (isReferenceSheet(sheetName)) {
    return { kind: "reference", label: "Reference Sheet" };
  }

  return { kind: "ignored" };
}

export function getPluginBySheetName(sheetName: string) {
  const classification = classifySheetForImport(sheetName);
  return classification.kind === "importable" ? classification.plugin : null;
}

export function getSupportedSheetNames() {
  return [
    "Bank Accounts",
    "MF Holdings",
    "Stock Holdings",
    "PPF Accounts",
    "Loan Inputs",
    "Health Insurance",
    "Life Insurance",
    "Fixed Deposits",
    "Gold",
    "Silver",
  ];
}
