import { describe, expect, it } from "vitest";

import type { Investment } from "@/types/investment";
import type { MonthEndCloseWorkspace } from "@/types/monthEndClose";

import { buildInvestmentValueMap } from "./investmentValueMap";

function buildInvestment(partial?: Partial<Investment>): Investment {
  return {
    id: partial?.id ?? "investment-1",
    user_id: partial?.user_id ?? "user-1",
    owner: partial?.owner ?? null,
    institution: partial?.institution ?? null,
    investment_name: partial?.investment_name ?? "Investment",
    investment_type: partial?.investment_type ?? "Mutual Funds",
    category: partial?.category ?? "Mutual Funds",
    acquisition_date: partial?.acquisition_date ?? null,
    cost_value: partial?.cost_value ?? 0,
    status: partial?.status ?? "active",
    notes: partial?.notes ?? null,
    documents_placeholder: partial?.documents_placeholder ?? null,
    monthly_change: partial?.monthly_change ?? 0,
    current_month_value: partial?.current_month_value ?? null,
    previous_month_value: partial?.previous_month_value ?? null,
    cost_basis: partial?.cost_basis ?? 0,
    purchase_date: partial?.purchase_date ?? null,
    units: partial?.units ?? 0,
    nav_price: partial?.nav_price ?? 0,
    today_gain_loss: partial?.today_gain_loss ?? 0,
    sector: partial?.sector ?? null,
    amc: partial?.amc ?? null,
    region: partial?.region ?? "Domestic",
    folio_number: partial?.folio_number ?? null,
    amfi_scheme_code: partial?.amfi_scheme_code ?? null,
    sip_amount: partial?.sip_amount ?? null,
    sip_date: partial?.sip_date ?? null,
    investment_mode: partial?.investment_mode ?? null,
    option_type: partial?.option_type ?? null,
    broker_platform: partial?.broker_platform ?? null,
    nominee: partial?.nominee ?? null,
    broker: partial?.broker ?? null,
    exchange: partial?.exchange ?? null,
    isin: partial?.isin ?? null,
    average_purchase_price: partial?.average_purchase_price ?? null,
    demat_account_provider: partial?.demat_account_provider ?? null,
    demat_account_number: partial?.demat_account_number ?? null,
    fd_number: partial?.fd_number ?? null,
    interest_rate: partial?.interest_rate ?? null,
    compounding_frequency: partial?.compounding_frequency ?? null,
    payout_type: partial?.payout_type ?? null,
    maturity_date: partial?.maturity_date ?? null,
    maturity_value: partial?.maturity_value ?? null,
    issuer: partial?.issuer ?? null,
    bond_name: partial?.bond_name ?? null,
    bond_type: partial?.bond_type ?? null,
    face_value: partial?.face_value ?? null,
    coupon_rate: partial?.coupon_rate ?? null,
    coupon_frequency: partial?.coupon_frequency ?? null,
    purchase_price: partial?.purchase_price ?? null,
    current_market_price: partial?.current_market_price ?? null,
    gold_type: partial?.gold_type ?? null,
    gold_unit: partial?.gold_unit ?? null,
    storage_location: partial?.storage_location ?? null,
    esop_vested_shares: partial?.esop_vested_shares ?? null,
    esop_current_share_price: partial?.esop_current_share_price ?? null,
    esop_grant_status: partial?.esop_grant_status ?? null,
    startup_funding_round: partial?.startup_funding_round ?? null,
    startup_ownership_percent: partial?.startup_ownership_percent ?? null,
    alternative_category: partial?.alternative_category ?? null,
    created_at: partial?.created_at ?? "2026-08-01T00:00:00.000Z",
    updated_at: partial?.updated_at ?? "2026-08-01T00:00:00.000Z",
    current_value: partial?.current_value ?? 0,
    gain_loss: partial?.gain_loss ?? 0,
    cagr: partial?.cagr ?? null,
    xirr: partial?.xirr ?? null,
    exposure: partial?.exposure ?? "equity",
  };
}

function buildWorkspace(actualValue: number, investmentId = "investment-1"): MonthEndCloseWorkspace {
  return {
    close: null,
    latestClose: null,
    month: {
      month: 8,
      year: 2026,
      monthKey: "2026-08",
      label: "August 2026",
    },
    status: "draft",
    items: [
      {
        rowKey: `investment:${investmentId}`,
        entityId: investmentId,
        entityType: "investment",
        entityTypeLabel: "Mutual Funds",
        entityName: "Investment",
        key: "mutual_funds",
        label: "Investment",
        itemType: "asset",
        sortOrder: 1,
        openingValue: 0,
        projectedValue: 0,
        actualValue,
        absoluteVariance: 0,
        percentageVariance: 0,
      },
    ],
    dashboard: {
      currentClosedMonth: null,
      pendingMonth: {
        month: 8,
        year: 2026,
        monthKey: "2026-08",
        label: "August 2026",
      },
      totalAssets: 0,
      totalLiabilities: 0,
      netWorth: 0,
      monthOverMonthChange: 0,
      projectionVariance: 0,
      largestPositiveVariance: null,
      largestNegativeVariance: null,
    },
  };
}

describe("buildInvestmentValueMap", () => {
  it("uses workspace snapshot value for investment ids", () => {
    const investment = buildInvestment({ id: "inv-a", current_value: 999999, investment_name: "Fund A" });
    const workspace = buildWorkspace(123456, "inv-a");

    const map = buildInvestmentValueMap(workspace, [investment]);

    expect(map.valuesById["inv-a"]).toBe("123456");
    expect(map.warningMessage).toBeNull();
  });

  it("returns warning and falls back to investment current value when workspace row is missing", () => {
    const investment = buildInvestment({ id: "inv-missing", investment_name: "Missing Row Fund", current_value: 777777 });
    const workspace = buildWorkspace(111111, "different-id");

    const result = buildInvestmentValueMap(workspace, [investment]);

    expect(result.valuesById["inv-missing"]).toBe("777777");
    expect(result.warningMessage).toBe("Some investments are not included in month-end review. Please check category mapping.");
    expect(result.missingRows).toEqual([
      {
        id: "inv-missing",
        name: "Missing Row Fund",
        category: "Mutual Funds",
      },
    ]);
  });

  it("does not warn for inactive investments missing in workspace", () => {
    const investment = buildInvestment({
      id: "inv-inactive",
      investment_name: "Inactive Fund",
      current_value: 1234,
      status: "inactive",
    });
    const workspace = buildWorkspace(111111, "different-id");

    const result = buildInvestmentValueMap(workspace, [investment]);
    expect(result.warningMessage).toBeNull();
  });

  it("does not warn for canonical-excluded retirement and precious-metal investments", () => {
    const epfInvestment = buildInvestment({ id: "inv-epf", investment_name: "EPF Legacy", category: "EPF", current_value: 100000 });
    const goldInvestment = buildInvestment({ id: "inv-gold", investment_name: "Gold ETF", category: "Gold", current_value: 200000 });
    const silverInvestment = buildInvestment({ id: "inv-silver", investment_name: "Silver ETF", category: "Silver", current_value: 50000 });
    const workspace = buildWorkspace(111111, "different-id");

    const result = buildInvestmentValueMap(
      workspace,
      [epfInvestment, goldInvestment, silverInvestment],
      {
        hasDedicatedRetirementAccounts: true,
        hasDedicatedGoldHoldings: true,
        hasDedicatedSilverHoldings: true,
      },
    );

    expect(result.warningMessage).toBeNull();
    expect(result.missingRows).toEqual([]);
  });
});
