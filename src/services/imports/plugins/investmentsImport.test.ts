import { describe, expect, it, vi } from "vitest";

import { investmentsImportPlugin } from "@/services/imports/plugins/investmentsImport";

vi.mock("@/services/investments", () => ({
  getInvestments: vi.fn(async () => []),
  createInvestment: vi.fn(),
  updateInvestment: vi.fn(),
  createInvestmentMonthlyHistory: vi.fn(),
}));

vi.mock("@/services/investments/mutualFundSchemeMaster", () => ({
  upsertMutualFundSchemeMaster: vi.fn(),
}));

describe("investmentsImportPlugin mutual funds mapping and calculations", () => {
  it("maps mutual fund template columns and computes current value from units x nav", async () => {
    const mfWorkbookRow = {
      "Scheme Name": "Axis Bluechip Fund",
      AMC: "Axis AMC",
      "Scheme Code": "120503",
      "Folio Number": "FOL-1001",
      Owner: "Priyesh",
      Nominee: "Spouse",
      "Investment Mode": "Direct",
      "Option Type": "Growth",
      Platform: "Groww",
      Units: 125.5,
      "Current NAV": 73.2,
      "Current Market Value": 999999,
      "Purchase Value": 8000,
      "Monthly SIP": 5000,
      "SIP Date": 5,
      "Purchase Date": "2025-06-10",
      Region: "Domestic",
      "Sector / Theme": "Large Cap",
      Notes: "Core equity holding",
      "Gain/Loss": 12345,
      "Gain %": 999,
    };

    const result = await investmentsImportPlugin.validateRows("MF Holdings", [mfWorkbookRow]);

    expect(result.records).toHaveLength(1);
    const payload = result.records[0]?.payload;
    expect(payload).toBeDefined();

    const values = payload!.values;

    expect(values.investment_name).toBe("Axis Bluechip Fund");
    expect(values.category).toBe("Mutual Funds");
    expect(values.amc).toBe("Axis AMC");
    expect(values.amfi_scheme_code).toBe("120503");
    expect(values.folio_number).toBe("FOL-1001");
    expect(values.owner).toBe("Priyesh");
    expect(values.nominee).toBe("Spouse");
    expect(values.investment_mode).toBe("Direct");
    expect(values.option_type).toBe("Growth");
    expect(values.broker_platform).toBe("Groww");
    expect(values.units).toBe(125.5);
    expect(values.nav_price).toBe(73.2);
    expect(values.cost_basis).toBe(8000);
    expect(values.sip_amount).toBe(5000);
    expect(values.sip_date).toBe(5);
    expect(values.purchase_date).toBe("2025-06-10");
    expect(values.region).toBe("Domestic");
    expect(values.sector).toBe("Large Cap");
    expect(values.notes).toBe("Core equity holding");

    const expectedCurrentValue = Number((125.5 * 73.2).toFixed(2));
    expect(values.current_value).toBe(expectedCurrentValue);

    const expectedGainLoss = Number((expectedCurrentValue - 8000).toFixed(2));
    expect(values.today_gain_loss).toBe(expectedGainLoss);

    const expectedGainPercent = Number(((expectedGainLoss / 8000) * 100).toFixed(4));
    const actualGainPercent = Number((((values.current_value ?? 0) - (values.cost_basis ?? 0)) / (values.cost_basis ?? 1) * 100).toFixed(4));
    expect(actualGainPercent).toBe(expectedGainPercent);

    expect(payload!.monthEndValue).toBe(expectedCurrentValue);

    const warningMessages = result.issues.filter((item) => item.severity === "warning").map((item) => item.message);
    expect(warningMessages.some((item) => item.includes("Current market value column is not imported"))).toBe(true);
    expect(warningMessages.some((item) => item.includes("Gain/Loss columns are ignored"))).toBe(true);
    expect(warningMessages.some((item) => item.includes("Gain % columns are ignored"))).toBe(true);
  });

  it("publishes column mapping entries for template and alias columns", () => {
    const rows = [
      {
        "Scheme Name": "Axis Bluechip Fund",
        AMC: "Axis AMC",
        "Scheme Code": "120503",
        "Folio Number": "FOL-1001",
        Owner: "Priyesh",
        Units: 125.5,
        "Current NAV": 73.2,
        "Purchase Value": 8000,
      },
    ];

    const mapping = investmentsImportPlugin.getColumnMapping?.("MF Holdings", rows) ?? [];
    const entryByField = new Map(mapping.map((item) => [item.field, item.workbookColumn]));

    expect(entryByField.get("investment_name")).toBe("Scheme Name");
    expect(entryByField.get("amc")).toBe("AMC");
    expect(entryByField.get("amfi_scheme_code")).toBe("Scheme Code");
    expect(entryByField.get("folio_number")).toBe("Folio Number");
    expect(entryByField.get("units")).toBe("Units");
    expect(entryByField.get("nav_price")).toBe("Current NAV");
    expect(entryByField.get("cost_basis")).toBe("Purchase Value");
  });
});
