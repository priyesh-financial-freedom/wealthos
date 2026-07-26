import { formulaRegistry } from "@/services/formulas";

import { addMonths, parseYearMonth } from "../shared";

import { createRuleContext } from "./RuleContext";
import { ruleBuilder } from "./RuleBuilder";
import { RuleEngine } from "./RuleEngine";
import { RuleRegistry } from "./RuleRegistry";
import type { RuleDefinition } from "./Types";

function baseMetadata(rule: Omit<RuleDefinition, "evaluate">): Omit<RuleDefinition, "evaluate"> {
  return rule;
}

export class RuleFactory {
  createRules(): RuleDefinition[] {
    const rules: RuleDefinition[] = [
      ruleBuilder.createLeafRule(baseMetadata({
        ruleId: "salary-stops-after-retirement",
        ruleName: "Salary Stops After Retirement",
        description: "Salary should stop after retirement.",
        category: "Income",
        priority: 10,
        effectiveDate: "2026-07-26",
        expiryDate: null,
        version: "1.0.0",
        formulaReference: formulaRegistry.reference("RULE-SALARY-STOP-RETIREMENT"),
        dependencies: [],
        evaluationFunctionName: "salaryStopsAfterRetirement",
        enabled: true,
      }), (context) => ({
        applied: Boolean(context.projectionMonth.retirementFlag),
        reason: context.projectionMonth.retirementFlag ? "Retirement flag is set for the month." : "Retirement flag is not set.",
        traceMetadata: { sourceModule: "RuleEngine" },
      })),
      ruleBuilder.createLeafRule(baseMetadata({
        ruleId: "salary-increment-month",
        ruleName: "Salary Increment Month",
        description: "Salary increment applies in the configured increment month.",
        category: "Income",
        priority: 20,
        effectiveDate: "2026-07-26",
        expiryDate: null,
        version: "1.0.0",
        formulaReference: formulaRegistry.reference("RULE-SALARY-INCREMENT-MONTH"),
        dependencies: [],
        evaluationFunctionName: "salaryIncrementMonth",
        enabled: true,
      }), (context) => ({
        applied: Boolean(context.projectionMonth.salaryIncrementMonth),
        reason: context.projectionMonth.salaryIncrementMonth ? "Projection month matches the salary increment month." : "Projection month does not match the salary increment month.",
        traceMetadata: { sourceModule: "RuleEngine" },
      })),
      ruleBuilder.createLeafRule(baseMetadata({
        ruleId: "bonus-month",
        ruleName: "Bonus Month",
        description: "Bonus applies in the configured bonus month.",
        category: "Income",
        priority: 30,
        effectiveDate: "2026-07-26",
        expiryDate: null,
        version: "1.0.0",
        formulaReference: formulaRegistry.reference("RULE-BONUS-MONTH"),
        dependencies: [],
        evaluationFunctionName: "bonusMonth",
        enabled: true,
      }), (context) => ({
        applied: Boolean(context.projectionMonth.bonusMonth),
        reason: context.projectionMonth.bonusMonth ? "Projection month matches the bonus month." : "Projection month does not match the bonus month.",
        traceMetadata: { sourceModule: "RuleEngine" },
      })),
      ruleBuilder.createLeafRule(baseMetadata({
        ruleId: "epf-only-while-employed",
        ruleName: "EPF Only While Employed",
        description: "EPF contributions apply only while employed.",
        category: "Retirement",
        priority: 40,
        effectiveDate: "2026-07-26",
        expiryDate: null,
        version: "1.0.0",
        formulaReference: formulaRegistry.reference("RULE-EPF-WHILE-EMPLOYED"),
        dependencies: [],
        evaluationFunctionName: "epfOnlyWhileEmployed",
        enabled: true,
      }), (context) => {
        const employmentProfile = context.projectionContext.planningInputs.EmploymentProfile as
          | { employmentStatus?: string | null }
          | null
          | undefined;
        const employmentStatus = String(context.facts.employmentStatus ?? employmentProfile?.employmentStatus ?? "").toUpperCase();
        const applied = employmentStatus === "SALARIED" || employmentStatus === "SELF_EMPLOYED" || employmentStatus === "BUSINESS_OWNER";

        return {
          applied,
          reason: applied ? "Employment status allows EPF contributions." : "Employment status does not allow EPF contributions.",
          traceMetadata: { sourceModule: "RuleEngine" },
        };
      }),
      ruleBuilder.createAndRule(baseMetadata({
        ruleId: "salary-active-after-retirement-check",
        ruleName: "Salary Active After Retirement Check",
        description: "Composite salary rule that requires not retired and employed.",
        category: "Income",
        priority: 15,
        effectiveDate: "2026-07-26",
        expiryDate: null,
        version: "1.0.0",
        formulaReference: formulaRegistry.reference("RULE-SALARY-STOP-RETIREMENT"),
        dependencies: [],
        evaluationFunctionName: "salaryActiveAfterRetirementCheck",
        enabled: true,
      }), ["salary-stops-after-retirement", "epf-only-while-employed"]),
      ruleBuilder.createLeafRule(baseMetadata({
        ruleId: "ppf-matures-after-15-years",
        ruleName: "PPF Matures After 15 Years",
        description: "PPF maturity applies once 15 years have elapsed since start.",
        category: "Retirement",
        priority: 50,
        effectiveDate: "2026-07-26",
        expiryDate: null,
        version: "1.0.0",
        formulaReference: formulaRegistry.reference("RULE-PPF-MATURITY-15Y"),
        dependencies: [],
        evaluationFunctionName: "ppfMaturesAfter15Years",
        enabled: true,
      }), (context) => {
        const startDate = String(context.facts.ppfStartDate ?? "");
        const start = parseYearMonth(startDate);
        const maturity = start ? addMonths(start, 180) : null;
        const applied = Boolean(maturity) && context.projectionMonth.monthKey >= `${maturity!.year}-${String(maturity!.month).padStart(2, "0")}`;

        return {
          applied,
          reason: applied ? "PPF maturity threshold has been reached." : "PPF maturity threshold has not yet been reached.",
          traceMetadata: { sourceModule: "RuleEngine" },
        };
      }),
      ruleBuilder.createLeafRule(baseMetadata({
        ruleId: "nps-starts-at-employment",
        ruleName: "NPS Starts At Employment",
        description: "NPS rule applies once employment has started.",
        category: "Retirement",
        priority: 60,
        effectiveDate: "2026-07-26",
        expiryDate: null,
        version: "1.0.0",
        formulaReference: formulaRegistry.reference("RULE-NPS-EMPLOYMENT-START"),
        dependencies: [],
        evaluationFunctionName: "npsStartsAtEmployment",
        enabled: true,
      }), (context) => {
        const employmentProfile = context.projectionContext.planningInputs.EmploymentProfile as
          | { effectiveDate?: string | null }
          | null
          | undefined;
        const employmentStartMonth = String(context.facts.employmentStartMonthKey ?? employmentProfile?.effectiveDate ?? "").slice(0, 7);
        const applied = Boolean(employmentStartMonth) && context.projectionMonth.monthKey >= employmentStartMonth;

        return {
          applied,
          reason: applied ? "Projection month is on or after employment start." : "Projection month is before employment start.",
          traceMetadata: { sourceModule: "RuleEngine" },
        };
      }),
      ruleBuilder.createLeafRule(baseMetadata({
        ruleId: "emi-ends-after-foreclosure",
        ruleName: "EMI Ends After Foreclosure",
        description: "EMI rule applies only until foreclosure.",
        category: "Loans",
        priority: 70,
        effectiveDate: "2026-07-26",
        expiryDate: null,
        version: "1.0.0",
        formulaReference: formulaRegistry.reference("RULE-EMI-FORECLOSURE"),
        dependencies: [],
        evaluationFunctionName: "emiEndsAfterForeclosure",
        enabled: true,
      }), (context) => ({
        applied: !Boolean(context.facts.foreclosed),
        reason: Boolean(context.facts.foreclosed) ? "Loan has been foreclosed." : "Loan remains active.",
        traceMetadata: { sourceModule: "RuleEngine" },
      })),
      ruleBuilder.createLeafRule(baseMetadata({
        ruleId: "insurance-renewal-month",
        ruleName: "Insurance Renewal Month",
        description: "Insurance rule applies in the renewal month.",
        category: "Insurance",
        priority: 80,
        effectiveDate: "2026-07-26",
        expiryDate: null,
        version: "1.0.0",
        formulaReference: formulaRegistry.reference("RULE-INSURANCE-RENEWAL-MONTH"),
        dependencies: [],
        evaluationFunctionName: "insuranceRenewalMonth",
        enabled: true,
      }), (context) => {
        const renewalMonth = Number(context.facts.renewalMonth ?? NaN);
        const applied = Number.isInteger(renewalMonth) && renewalMonth === context.projectionMonth.month;

        return {
          applied,
          reason: applied ? "Projection month matches the insurance renewal month." : "Projection month does not match the insurance renewal month.",
          traceMetadata: { sourceModule: "RuleEngine" },
        };
      }),
      ruleBuilder.createLeafRule(baseMetadata({
        ruleId: "vacation-expense-december",
        ruleName: "Vacation Expense Every December",
        description: "Vacation expense applies every December.",
        category: "Expenses",
        priority: 90,
        effectiveDate: "2026-07-26",
        expiryDate: null,
        version: "1.0.0",
        formulaReference: formulaRegistry.reference("RULE-VACATION-DECEMBER"),
        dependencies: [],
        evaluationFunctionName: "vacationExpenseDecember",
        enabled: true,
      }), (context) => ({
        applied: context.projectionMonth.month === 12,
        reason: context.projectionMonth.month === 12 ? "Projection month is December." : "Projection month is not December.",
        traceMetadata: { sourceModule: "RuleEngine" },
      })),
      ruleBuilder.createLeafRule(baseMetadata({
        ruleId: "education-until-graduation",
        ruleName: "Education Expense Until Graduation",
        description: "Education expense applies until the graduation month.",
        category: "Expenses",
        priority: 100,
        effectiveDate: "2026-07-26",
        expiryDate: null,
        version: "1.0.0",
        formulaReference: formulaRegistry.reference("RULE-EDUCATION-UNTIL-GRADUATION"),
        dependencies: [],
        evaluationFunctionName: "educationUntilGraduation",
        enabled: true,
      }), (context) => {
        const graduationMonth = String(context.facts.graduationMonthKey ?? "");
        const applied = Boolean(graduationMonth) && context.projectionMonth.monthKey <= graduationMonth;

        return {
          applied,
          reason: applied ? "Projection month is on or before graduation month." : "Projection month is after graduation month.",
          traceMetadata: { sourceModule: "RuleEngine" },
        };
      }),
      ruleBuilder.createLeafRule(baseMetadata({
        ruleId: "goal-funding-after-trigger",
        ruleName: "Goal Funding Only After Trigger",
        description: "Goal funding applies only after the trigger month.",
        category: "Goals",
        priority: 110,
        effectiveDate: "2026-07-26",
        expiryDate: null,
        version: "1.0.0",
        formulaReference: formulaRegistry.reference("RULE-GOAL-FUNDING-TRIGGER"),
        dependencies: [],
        evaluationFunctionName: "goalFundingAfterTrigger",
        enabled: true,
      }), (context) => ({
        applied: Boolean(context.facts.goalTriggerReached),
        reason: Boolean(context.facts.goalTriggerReached) ? "Goal trigger has been reached." : "Goal trigger has not been reached.",
        traceMetadata: { sourceModule: "RuleEngine" },
      })),
      ruleBuilder.createLeafRule(baseMetadata({
        ruleId: "tax-regime-selection",
        ruleName: "Tax Regime Selection",
        description: "Tax regime selection applies when a regime is selected.",
        category: "Taxes",
        priority: 120,
        effectiveDate: "2026-07-26",
        expiryDate: null,
        version: "1.0.0",
        formulaReference: formulaRegistry.reference("RULE-TAX-REGIME-SELECTION"),
        dependencies: [],
        evaluationFunctionName: "taxRegimeSelection",
        enabled: true,
      }), (context) => ({
        applied: Boolean(context.facts.taxRegimeSelected ?? (context.projectionContext.planningInputs.TaxProfile as { taxRegime?: string | null } | null | undefined)?.taxRegime),
        reason: Boolean(context.facts.taxRegimeSelected ?? (context.projectionContext.planningInputs.TaxProfile as { taxRegime?: string | null } | null | undefined)?.taxRegime) ? "Tax regime is selected." : "Tax regime is not selected.",
        traceMetadata: { sourceModule: "RuleEngine" },
      })),
    ];

    return rules;
  }

  createRegistry(): RuleRegistry {
    return new RuleRegistry(this.createRules());
  }

  createEngine(): RuleEngine {
    return new RuleEngine(this.createRegistry());
  }

  createContext(input: Parameters<typeof createRuleContext>[0]) {
    return ruleBuilder.buildRuleContext(input);
  }
}

export const ruleFactory = new RuleFactory();
