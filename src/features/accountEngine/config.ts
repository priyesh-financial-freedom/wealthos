import type { UniversalAccountType } from "@/types/universalAccount";

export type UniversalAccountClass = "cash" | "investment" | "retirement" | "real" | "liability" | "protection" | "other";

export interface UniversalAccountTypeConfig {
  type: UniversalAccountType;
  label: string;
  class: UniversalAccountClass;
  supportsInterest: boolean;
  supportsMaturity: boolean;
  weightSign: 1 | -1;
}

export const UNIVERSAL_ACCOUNT_TYPES: UniversalAccountTypeConfig[] = [
  { type: "Savings Account", label: "Savings Account", class: "cash", supportsInterest: true, supportsMaturity: false, weightSign: 1 },
  { type: "Salary Account", label: "Salary Account", class: "cash", supportsInterest: true, supportsMaturity: false, weightSign: 1 },
  { type: "Current Account", label: "Current Account", class: "cash", supportsInterest: false, supportsMaturity: false, weightSign: 1 },
  { type: "Cash", label: "Cash", class: "cash", supportsInterest: false, supportsMaturity: false, weightSign: 1 },
  { type: "Wallet", label: "Wallet", class: "cash", supportsInterest: false, supportsMaturity: false, weightSign: 1 },
  { type: "EPF", label: "EPF", class: "retirement", supportsInterest: true, supportsMaturity: false, weightSign: 1 },
  { type: "PPF", label: "PPF", class: "retirement", supportsInterest: true, supportsMaturity: true, weightSign: 1 },
  { type: "NPS", label: "NPS", class: "retirement", supportsInterest: false, supportsMaturity: false, weightSign: 1 },
  { type: "Fixed Deposit", label: "Fixed Deposit", class: "investment", supportsInterest: true, supportsMaturity: true, weightSign: 1 },
  { type: "Mutual Fund", label: "Mutual Fund", class: "investment", supportsInterest: false, supportsMaturity: false, weightSign: 1 },
  { type: "Stock Portfolio", label: "Stock Portfolio", class: "investment", supportsInterest: false, supportsMaturity: false, weightSign: 1 },
  { type: "Gold", label: "Gold", class: "real", supportsInterest: false, supportsMaturity: false, weightSign: 1 },
  { type: "Silver", label: "Silver", class: "real", supportsInterest: false, supportsMaturity: false, weightSign: 1 },
  { type: "Bonds", label: "Bonds", class: "investment", supportsInterest: true, supportsMaturity: true, weightSign: 1 },
  { type: "Real Estate", label: "Real Estate", class: "real", supportsInterest: false, supportsMaturity: false, weightSign: 1 },
  { type: "Vehicle", label: "Vehicle", class: "real", supportsInterest: false, supportsMaturity: false, weightSign: 1 },
  { type: "Insurance", label: "Insurance", class: "protection", supportsInterest: false, supportsMaturity: true, weightSign: 1 },
  { type: "Credit Card", label: "Credit Card", class: "liability", supportsInterest: true, supportsMaturity: false, weightSign: -1 },
  { type: "Loan", label: "Loan", class: "liability", supportsInterest: true, supportsMaturity: true, weightSign: -1 },
];

export const UNIVERSAL_ACCOUNT_TYPE_MAP = new Map(UNIVERSAL_ACCOUNT_TYPES.map((entry) => [entry.type, entry]));
