// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ProjectionSnapshotSelector } from "./ProjectionSnapshotSelector";

afterEach(() => {
  cleanup();
});

describe("ProjectionSnapshotSelector", () => {
  it("updates the displayed snapshot when the month changes and when quick jumps are used", () => {
    render(
      <ProjectionSnapshotSelector
        monthSnapshots={[
          {
            month: "2026-08",
            net_worth: 680000,
            financial_assets_total: 500000,
            retirement_corpus: 400000,
            property_value: 300000,
            total_debt: 120000,
            monthly_income: 50000,
            monthly_expense: 30000,
            corpus_drawdown: 0,
          },
          {
            month: "2026-09",
            net_worth: 700000,
            financial_assets_total: 520000,
            retirement_corpus: 410000,
            property_value: 305000,
            total_debt: 118000,
            monthly_income: 50000,
            monthly_expense: 32000,
            corpus_drawdown: 0,
          },
          {
            month: "2034-08",
            net_worth: 1500000,
            financial_assets_total: 1200000,
            retirement_corpus: 900000,
            property_value: 650000,
            total_debt: 60000,
            monthly_income: 0,
            monthly_expense: 45000,
            corpus_drawdown: 45000,
          },
        ]}
        projectionStartMonth="2026-08"
        projectionEndMonth="2035-12"
        primaryCurrentAge={60}
        retirementAge={68}
      />,
    );

    expect(screen.getByRole("heading", { name: "Aug 2026" })).toBeTruthy();
    expect(screen.getByText("Property / Non-Financial Assets")).toBeTruthy();
    expect(screen.getByText("Monthly Surplus / Shortfall")).toBeTruthy();
    expect(screen.getByText("₹6,80,000")).toBeTruthy();

    fireEvent.change(screen.getByDisplayValue("2026-08"), { target: { value: "2026-09" } });

    expect(screen.getByRole("heading", { name: "Sep 2026" })).toBeTruthy();
    expect(screen.getByText("₹7,00,000")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retirement" }));

    expect(screen.getByRole("heading", { name: "Aug 2034" })).toBeTruthy();
    expect(screen.getByText("₹15,00,000")).toBeTruthy();
    expect(screen.getAllByText("₹45,000")).toHaveLength(2);
  });

  it("supports preview snapshot payloads with retirement jump", () => {
    render(
      <ProjectionSnapshotSelector
        monthSnapshots={[
          {
            month: "2030-01",
            net_worth: 1000000,
            financial_assets_total: 700000,
            retirement_corpus: 500000,
            property_value: 300000,
            total_debt: 120000,
            monthly_income: 90000,
            monthly_expense: 50000,
            corpus_drawdown: 0,
          },
          {
            month: "2034-08",
            net_worth: 2200000,
            financial_assets_total: 1800000,
            retirement_corpus: 1300000,
            property_value: 500000,
            total_debt: 0,
            monthly_income: 0,
            monthly_expense: 70000,
            corpus_drawdown: 70000,
          },
        ]}
        projectionStartMonth="2030-01"
        projectionEndMonth="2040-12"
        primaryCurrentAge={60}
        retirementAge={68}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retirement" }));

    expect(screen.getByRole("heading", { name: "Aug 2034" })).toBeTruthy();
    expect(screen.getByText("₹22,00,000")).toBeTruthy();
  });
});