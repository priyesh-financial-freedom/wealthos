// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FinancialHealth } from "./FinancialHealth";

const components = [
  {
    key: "savingsRate" as const,
    label: "Savings Rate",
    score: 18,
    maxScore: 20,
    status: "green" as const,
    reason: "Savings rate is supporting long-term planning.",
  },
  {
    key: "retirementReadiness" as const,
    label: "Retirement Readiness",
    score: 14,
    maxScore: 20,
    status: "amber" as const,
    reason: "Retirement corpus is below planned requirement.",
  },
  {
    key: "debtRatio" as const,
    label: "Debt Ratio",
    score: 10,
    maxScore: 20,
    status: "red" as const,
    reason: "Debt load is elevated versus target policy.",
  },
  {
    key: "goalReadiness" as const,
    label: "Goal Readiness",
    score: 16,
    maxScore: 20,
    status: "green" as const,
    reason: "Goal funding progress is healthy.",
  },
  {
    key: "emergencyFund" as const,
    label: "Emergency Fund",
    score: null,
    maxScore: 10,
    status: "amber" as const,
    reason: "Set assumptions to calculate this metric",
  },
  {
    key: "insuranceCoverage" as const,
    label: "Insurance Coverage",
    score: 8,
    maxScore: 10,
    status: "green" as const,
    reason: "Coverage is within target range.",
  },
];

afterEach(() => {
  cleanup();
});

describe("FinancialHealth", () => {
  it("hides the score breakdown by default and keeps main score visible", () => {
    render(
      <FinancialHealth
        score={88}
        rating="Excellent"
        detail="Balance sheet quality is strong."
        components={components}
      />,
    );

    expect(screen.getByText("Financial Health Score")).toBeTruthy();
    expect(screen.getByText("88")).toBeTruthy();
    expect(screen.getByText("Excellent")).toBeTruthy();
    expect(screen.getByText("Balance sheet quality is strong.")).toBeTruthy();

    expect(screen.getByRole("button", { name: "View score breakdown" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Savings Rate")).toBeNull();
    expect(screen.queryByText("Retirement Readiness")).toBeNull();
    expect(screen.queryByText("Debt Ratio")).toBeNull();
    expect(screen.queryByText("Goal Readiness")).toBeNull();
    expect(screen.queryByText("Emergency Fund")).toBeNull();
    expect(screen.queryByText("Insurance Coverage")).toBeNull();
  });

  it("shows and hides the breakdown on toggle click and preserves Data required state", () => {
    render(
      <FinancialHealth
        score={72}
        rating="Good"
        detail="The balance sheet is stable."
        components={components}
      />,
    );

    const showButton = screen.getByRole("button", { name: "View score breakdown" });
    fireEvent.click(showButton);

    expect(screen.getByRole("button", { name: "Hide score breakdown" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Savings Rate")).toBeTruthy();
    expect(screen.getByText("Retirement Readiness")).toBeTruthy();
    expect(screen.getByText("Debt Ratio")).toBeTruthy();
    expect(screen.getByText("Goal Readiness")).toBeTruthy();
    expect(screen.getByText("Emergency Fund")).toBeTruthy();
    expect(screen.getByText("Insurance Coverage")).toBeTruthy();
    expect(screen.getByText("Data required")).toBeTruthy();

    expect(screen.getByText("Financial Health Score")).toBeTruthy();
    expect(screen.getByText("72")).toBeTruthy();
    expect(screen.getByText("Good")).toBeTruthy();

    const hideButton = screen.getByRole("button", { name: "Hide score breakdown" });
    fireEvent.click(hideButton);

    expect(screen.getByRole("button", { name: "View score breakdown" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Savings Rate")).toBeNull();
    expect(screen.queryByText("Data required")).toBeNull();
    expect(screen.getByText("Financial Health Score")).toBeTruthy();
    expect(screen.getByText("72")).toBeTruthy();
  });
});
