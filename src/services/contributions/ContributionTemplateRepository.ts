import type { ContributionTemplate } from "@/types/contributionPolicy";

const seededTemplates: ContributionTemplate[] = [
  {
    id: "young-professional",
    name: "Young Professional",
    description: "Balanced growth starter template focused on habit building and emergency protection.",
    policies: [
      {
        name: "Starter SIP",
        description: "Core monthly SIP for long-term wealth building.",
        targetAccount: "SIP",
        amount: 15000,
        frequency: "MONTHLY",
        growthStrategy: "STEP_UP_PERCENTAGE",
        growthRate: 10,
        cashProtectionEnabled: true,
      },
      {
        name: "Emergency Buffer",
        description: "Monthly contribution to emergency liquidity reserve.",
        targetAccount: "Liquid Fund",
        amount: 5000,
        frequency: "MONTHLY",
        growthStrategy: "FIXED",
        cashProtectionEnabled: true,
      },
    ],
  },
  {
    id: "high-income-executive",
    name: "High Income Executive",
    description: "Aggressive allocation mix with structured annual step-up discipline.",
    policies: [
      {
        name: "Executive SIP",
        description: "High-value SIP contribution with annual increase.",
        targetAccount: "SIP",
        amount: 75000,
        frequency: "MONTHLY",
        growthStrategy: "STEP_UP_PERCENTAGE",
        growthRate: 12,
        cashProtectionEnabled: true,
      },
      {
        name: "Tax Optimized Retirement",
        description: "Blend EPF/PPF/NPS capacity over the year.",
        targetAccount: "NPS",
        amount: 50000,
        frequency: "QUARTERLY",
        growthStrategy: "STEP_UP_AMOUNT",
        growthAmount: 5000,
        cashProtectionEnabled: false,
      },
    ],
  },
  {
    id: "early-retirement",
    name: "Early Retirement",
    description: "High savings intensity template focused on accelerated financial independence.",
    policies: [
      {
        name: "FI Acceleration SIP",
        description: "High monthly contribution for early retirement corpus growth.",
        targetAccount: "SIP",
        amount: 100000,
        frequency: "MONTHLY",
        growthStrategy: "STEP_UP_PERCENTAGE",
        growthRate: 15,
        cashProtectionEnabled: true,
      },
      {
        name: "Retirement Bucket",
        description: "Annual retirement top-up.",
        targetAccount: "PPF",
        amount: 150000,
        frequency: "ANNUALLY",
        growthStrategy: "FIXED",
        cashProtectionEnabled: false,
      },
    ],
  },
  {
    id: "conservative-investor",
    name: "Conservative Investor",
    description: "Capital-preservation-first template with predictable and low-volatility contributions.",
    policies: [
      {
        name: "Conservative FD Ladder",
        description: "Quarterly fixed deposit ladder allocation.",
        targetAccount: "FD",
        amount: 25000,
        frequency: "QUARTERLY",
        growthStrategy: "FIXED",
        cashProtectionEnabled: true,
      },
      {
        name: "Low-Risk Liquid Reserve",
        description: "Monthly liquid reserve maintenance.",
        targetAccount: "Liquid Fund",
        amount: 10000,
        frequency: "MONTHLY",
        growthStrategy: "STEP_UP_AMOUNT",
        growthAmount: 500,
        cashProtectionEnabled: true,
      },
    ],
  },
];

export class ContributionTemplateRepository {
  async listTemplates(): Promise<ContributionTemplate[]> {
    return seededTemplates;
  }

  async getTemplate(templateId: string): Promise<ContributionTemplate | null> {
    return seededTemplates.find((template) => template.id === templateId) ?? null;
  }
}
