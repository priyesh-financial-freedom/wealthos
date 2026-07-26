import type { ComponentType } from "react";
import {
  BriefcaseBusiness,
  Building2,
  Coins,
  Gem,
  Landmark,
  ShieldCheck,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import type { InvestmentCategory } from "@/types/investment";

export const primaryInvestmentCategories: InvestmentCategory[] = [
  "Mutual Funds",
  "Stocks",
  "Bonds",
  "Fixed Deposits",
  "Gold",
  "ESOPs",
  "Startup Investments",
  "Other Investments",
];

type CategoryMeta = {
  displayName: string;
  singularName: string;
  addLabel: string;
  icon: ComponentType<{ className?: string }>;
};

export const investmentCategoryMeta: Record<InvestmentCategory, CategoryMeta> = {
  "Mutual Funds": {
    displayName: "Mutual Funds",
    singularName: "Mutual Fund",
    addLabel: "Add Mutual Fund",
    icon: TrendingUp,
  },
  Stocks: {
    displayName: "Stocks",
    singularName: "Stock",
    addLabel: "Add Stock",
    icon: WalletCards,
  },
  Bonds: {
    displayName: "Bonds",
    singularName: "Bond",
    addLabel: "Add Bond",
    icon: ShieldCheck,
  },
  "Fixed Deposits": {
    displayName: "Fixed Deposits",
    singularName: "Fixed Deposit",
    addLabel: "Add Fixed Deposit",
    icon: Landmark,
  },
  Gold: {
    displayName: "Gold",
    singularName: "Gold Investment",
    addLabel: "Add Gold Investment",
    icon: Gem,
  },
  ESOPs: {
    displayName: "ESOPs",
    singularName: "ESOP",
    addLabel: "Add ESOP",
    icon: BriefcaseBusiness,
  },
  "Startup Investments": {
    displayName: "Startup Investments",
    singularName: "Startup Investment",
    addLabel: "Add Startup Investment",
    icon: Building2,
  },
  "Other Investments": {
    displayName: "Alternative Investments",
    singularName: "Alternative Investment",
    addLabel: "Add Alternative Investment",
    icon: Coins,
  },
  ETFs: {
    displayName: "ETFs",
    singularName: "ETF",
    addLabel: "Add ETF",
    icon: WalletCards,
  },
  EPF: {
    displayName: "EPF",
    singularName: "EPF",
    addLabel: "Add EPF",
    icon: Landmark,
  },
  PPF: {
    displayName: "PPF",
    singularName: "PPF",
    addLabel: "Add PPF",
    icon: Landmark,
  },
  NPS: {
    displayName: "NPS",
    singularName: "NPS",
    addLabel: "Add NPS",
    icon: Landmark,
  },
  Silver: {
    displayName: "Silver",
    singularName: "Silver Investment",
    addLabel: "Add Silver Investment",
    icon: Coins,
  },
  "Sovereign Gold Bonds": {
    displayName: "Sovereign Gold Bonds",
    singularName: "Sovereign Gold Bond",
    addLabel: "Add Sovereign Gold Bond",
    icon: Gem,
  },
  Crypto: {
    displayName: "Crypto",
    singularName: "Crypto Investment",
    addLabel: "Add Crypto Investment",
    icon: Coins,
  },
  "Cash Equivalents": {
    displayName: "Cash Equivalents",
    singularName: "Cash Equivalent",
    addLabel: "Add Cash Equivalent",
    icon: WalletCards,
  },
};

export function getInvestmentCategoryMeta(category: InvestmentCategory) {
  return investmentCategoryMeta[category];
}
