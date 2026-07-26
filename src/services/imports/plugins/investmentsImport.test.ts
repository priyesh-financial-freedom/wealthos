import { describe, expect, it, vi } from "vitest";

import { investmentsImportPlugin } from "@/services/imports/plugins/investmentsImport";
import { getInvestments } from "@/services/investments";

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
  it("skips duplicate stock rows in the same file using Owner + Demat Account + ISIN", async () => {
    vi.mocked(getInvestments).mockResolvedValue([]);

    const rows = [
      {
        "Investment Name": "Reliance Industries",
        Category: "Stocks",
        Owner: "Priyesh",
        "Demat Account Number": "IN3001-12345678",
        ISIN: "ine002a01018",
        Units: 10,
        "Average Buy Price": 2500,
        "Current Price": 3000,
        "Purchase Value": 25000,
      },
      {
        "Investment Name": "Reliance Industries",
        Category: "Stocks",
        Owner: "Priyesh",
        "Demat Account Number": "IN3001-12345678",
        ISIN: "INE002A01018",
        Units: 5,
        "Average Buy Price": 2400,
        "Current Price": 3050,
        "Purchase Value": 12000,
      },
    ];

    const result = await investmentsImportPlugin.validateRows("Stock Holdings", rows);

    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.action).toBe("create");
    expect(result.records[0]?.payload.values.isin).toBe("INE002A01018");
    expect(result.records[0]?.payload.values.demat_account_number).toBe("IN3001-12345678");

    const warningMessages = result.issues.filter((item) => item.severity === "warning").map((item) => item.message);
    expect(warningMessages.some((message) => message.includes("Duplicate Stock row in this file"))).toBe(true);
  });

  it("updates existing stock row when Owner + Demat Account + ISIN already exists", async () => {
    vi.mocked(getInvestments).mockResolvedValue([
      {
        id: "9eb89e5e-5454-450f-a9ad-c8fcb9be0508",
        user_id: "user-1",
        owner: "Priyesh",
        institution: "Zerodha",
        investment_name: "Reliance Industries",
        investment_type: "Stocks",
        category: "Stocks",
        acquisition_date: "2025-01-01",
        cost_value: 20000,
        status: "active",
        notes: null,
        documents_placeholder: null,
        monthly_change: 0,
        current_month_value: null,
        previous_month_value: null,
        cost_basis: 20000,
        purchase_date: "2025-01-01",
        units: 10,
        nav_price: 2500,
        today_gain_loss: 0,
        sector: null,
        amc: null,
        region: "Domestic",
        folio_number: null,
        amfi_scheme_code: null,
        sip_amount: null,
        sip_date: null,
        investment_mode: null,
        option_type: null,
        broker_platform: null,
        nominee: null,
        broker: "Zerodha",
        exchange: "NSE",
        isin: "INE002A01018",
        average_purchase_price: 2500,
        demat_account_provider: "CDSL",
        demat_account_number: "IN3001-12345678",
        fd_number: null,
        interest_rate: null,
        compounding_frequency: null,
        payout_type: null,
        maturity_date: null,
        maturity_value: null,
        created_at: "2025-01-01T00:00:00.000Z",
        updated_at: "2025-01-01T00:00:00.000Z",
        current_value: 25000,
        gain_loss: 5000,
        cagr: null,
        xirr: null,
        exposure: "equity",
      },
    ]);

    const result = await investmentsImportPlugin.validateRows("Stock Holdings", [
      {
        "Investment Name": "Reliance Industries",
        Category: "Stocks",
        Owner: "Priyesh",
        "Demat Account Number": "IN3001-12345678",
        ISIN: "ine002a01018",
        Units: 12,
        "Average Buy Price": 2250,
        "Current Price": 3100,
        "Purchase Value": 27000,
      },
    ]);

    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.action).toBe("update");
    expect(result.records[0]?.payload.id).toBe("9eb89e5e-5454-450f-a9ad-c8fcb9be0508");

    const warningMessages = result.issues.filter((item) => item.severity === "warning").map((item) => item.message);
    expect(warningMessages.some((message) => message.includes("Matching Stock already exists based on duplicate key resolution"))).toBe(true);
  });

  it("accepts stock rows with missing ISIN, Demat Account Number, and Current Price using fallback duplicate key", async () => {
    vi.mocked(getInvestments).mockResolvedValue([
      {
        id: "8a6baf8c-38a4-4f38-91f0-59c0fa967956",
        user_id: "user-1",
        owner: "Priyesh",
        institution: "Zerodha",
        investment_name: "Infosys",
        investment_type: "Stocks",
        category: "Stocks",
        acquisition_date: "2025-01-01",
        cost_value: 20000,
        status: "active",
        notes: null,
        documents_placeholder: null,
        monthly_change: 0,
        current_month_value: null,
        previous_month_value: null,
        cost_basis: 20000,
        purchase_date: "2025-01-01",
        units: 10,
        nav_price: 0,
        today_gain_loss: 0,
        sector: null,
        amc: null,
        region: "Domestic",
        folio_number: null,
        amfi_scheme_code: null,
        sip_amount: null,
        sip_date: null,
        investment_mode: null,
        option_type: null,
        broker_platform: null,
        nominee: null,
        broker: "Zerodha",
        exchange: "NSE",
        isin: null,
        average_purchase_price: 2000,
        demat_account_provider: null,
        demat_account_number: null,
        fd_number: null,
        interest_rate: null,
        compounding_frequency: null,
        payout_type: null,
        maturity_date: null,
        maturity_value: null,
        created_at: "2025-01-01T00:00:00.000Z",
        updated_at: "2025-01-01T00:00:00.000Z",
        current_value: 20000,
        gain_loss: 0,
        cagr: null,
        xirr: null,
        exposure: "equity",
      },
    ]);

    const result = await investmentsImportPlugin.validateRows("Stock Holdings", [
      {
        "Company Name": "Infosys",
        Category: "Stocks",
        Owner: "Priyesh",
        Quantity: 8,
        "Average Buy Price": 2100,
      },
    ]);

    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.action).toBe("update");
    expect(result.records[0]?.payload.id).toBe("8a6baf8c-38a4-4f38-91f0-59c0fa967956");
    expect(result.records[0]?.payload.values.current_value).toBe(16800);

    const errorCount = result.issues.filter((item) => item.severity === "error").length;
    expect(errorCount).toBe(0);

    const warningMessages = result.issues.filter((item) => item.severity === "warning").map((item) => item.message);
    expect(warningMessages.some((message) => message.includes("Demat Account Number is missing"))).toBe(true);
    expect(warningMessages.some((message) => message.includes("ISIN is missing"))).toBe(true);
    expect(warningMessages.some((message) => message.includes("Current Price is missing"))).toBe(true);
  });

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

  it("updates existing fixed deposit row when Owner + Institution + FD Number already exists", async () => {
    vi.mocked(getInvestments).mockResolvedValue([
      {
        id: "46ff46fe-43a5-44f4-b0f6-4e649ac3e95b",
        user_id: "user-1",
        owner: "Priyesh",
        institution: "HDFC Bank",
        investment_name: "HDFC FD 12345",
        investment_type: "Fixed Deposits",
        category: "Fixed Deposits",
        acquisition_date: "2025-01-01",
        cost_value: 100000,
        status: "active",
        notes: null,
        documents_placeholder: null,
        monthly_change: 0,
        current_month_value: null,
        previous_month_value: null,
        cost_basis: 100000,
        purchase_date: "2025-01-01",
        units: 1,
        nav_price: 104000,
        today_gain_loss: 4000,
        sector: null,
        amc: null,
        region: "Domestic",
        folio_number: null,
        amfi_scheme_code: null,
        sip_amount: null,
        sip_date: null,
        investment_mode: null,
        option_type: null,
        broker_platform: null,
        nominee: null,
        broker: null,
        exchange: null,
        isin: null,
        average_purchase_price: null,
        demat_account_provider: null,
        demat_account_number: null,
        fd_number: "FD-12345",
        interest_rate: 7.2,
        compounding_frequency: "quarterly",
        payout_type: "cumulative",
        maturity_date: "2028-01-01",
        maturity_value: 124500,
        created_at: "2025-01-01T00:00:00.000Z",
        updated_at: "2025-01-01T00:00:00.000Z",
        current_value: 104000,
        gain_loss: 4000,
        cagr: null,
        xirr: null,
        exposure: "debt",
      },
    ]);

    const result = await investmentsImportPlugin.validateRows("FD Holdings", [
      {
        "Bank": "HDFC Bank",
        "FD Number": "fd-12345",
        Owner: "Priyesh",
        Principal: 100000,
        "Interest Rate": 7.2,
        "Compounding Frequency": "quarterly",
        "Payout Type": "cumulative",
        "Start Date": "2025-01-01",
        "Maturity Date": "2028-01-01",
      },
    ]);

    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.action).toBe("update");
    expect(result.records[0]?.payload.id).toBe("46ff46fe-43a5-44f4-b0f6-4e649ac3e95b");
    expect(result.records[0]?.payload.values.fd_number).toBe("fd-12345");
    expect(result.records[0]?.payload.values.institution).toBe("HDFC Bank");

    const warningMessages = result.issues.filter((item) => item.severity === "warning").map((item) => item.message);
    expect(warningMessages.some((message) => message.includes("Matching Fixed Deposit"))).toBe(true);
  });

  it("updates existing bond rows using Owner + ISIN first, then Owner + Issuer + Bond Name fallback", async () => {
    vi.mocked(getInvestments).mockResolvedValue([
      {
        id: "f11eaf8a-f8a1-4ee2-a50c-45d7a1640f83",
        user_id: "user-1",
        owner: "Priyesh",
        institution: "NHAI",
        issuer: "NHAI",
        bond_name: "NHAI Tax Free Bond 2035",
        bond_type: "Tax Free Bond",
        face_value: 1000,
        coupon_rate: 7.1,
        coupon_frequency: "Half-Yearly",
        purchase_price: 1012.5,
        current_market_price: 1040,
        investment_name: "NHAI Tax Free Bond 2035",
        investment_type: "Bonds",
        category: "Bonds",
        acquisition_date: "2025-02-10",
        cost_value: 253125,
        status: "active",
        notes: null,
        documents_placeholder: null,
        monthly_change: 0,
        current_month_value: null,
        previous_month_value: null,
        cost_basis: 253125,
        purchase_date: "2025-02-10",
        units: 250,
        nav_price: 1040,
        today_gain_loss: 6875,
        sector: null,
        amc: null,
        region: "Domestic",
        folio_number: null,
        amfi_scheme_code: null,
        sip_amount: null,
        sip_date: null,
        investment_mode: null,
        option_type: null,
        broker_platform: null,
        nominee: null,
        broker: "ICICI Direct",
        exchange: null,
        isin: "INE906B07CB9",
        average_purchase_price: 1012.5,
        demat_account_provider: null,
        demat_account_number: null,
        fd_number: null,
        interest_rate: null,
        compounding_frequency: null,
        payout_type: null,
        maturity_date: "2035-02-10",
        maturity_value: null,
        created_at: "2025-02-10T00:00:00.000Z",
        updated_at: "2025-02-10T00:00:00.000Z",
        current_value: 260000,
        gain_loss: 6875,
        cagr: null,
        xirr: null,
        exposure: "debt",
      },
      {
        id: "faf9918c-2ba0-4bc9-ac5b-d5f95f08ecca",
        user_id: "user-1",
        owner: "Priyesh",
        institution: "REC",
        issuer: "REC",
        bond_name: "REC Bond 2034",
        bond_type: "Corporate Bond",
        face_value: 1000,
        coupon_rate: 7.8,
        coupon_frequency: "Annual",
        purchase_price: 998,
        current_market_price: 1021,
        investment_name: "REC Bond 2034",
        investment_type: "Bonds",
        category: "Bonds",
        acquisition_date: "2024-05-01",
        cost_value: 99800,
        status: "active",
        notes: null,
        documents_placeholder: null,
        monthly_change: 0,
        current_month_value: null,
        previous_month_value: null,
        cost_basis: 99800,
        purchase_date: "2024-05-01",
        units: 100,
        nav_price: 1021,
        today_gain_loss: 2300,
        sector: null,
        amc: null,
        region: "Domestic",
        folio_number: null,
        amfi_scheme_code: null,
        sip_amount: null,
        sip_date: null,
        investment_mode: null,
        option_type: null,
        broker_platform: null,
        nominee: null,
        broker: "Zerodha",
        exchange: null,
        isin: null,
        average_purchase_price: 998,
        demat_account_provider: null,
        demat_account_number: null,
        fd_number: null,
        interest_rate: null,
        compounding_frequency: null,
        payout_type: null,
        maturity_date: "2034-05-01",
        maturity_value: null,
        created_at: "2024-05-01T00:00:00.000Z",
        updated_at: "2024-05-01T00:00:00.000Z",
        current_value: 102100,
        gain_loss: 2300,
        cagr: null,
        xirr: null,
        exposure: "debt",
      },
    ]);

    const result = await investmentsImportPlugin.validateRows("Bond Holdings", [
      {
        "Bond Name": "NHAI Tax Free Bond 2035",
        Category: "Bonds",
        Owner: "Priyesh",
        Issuer: "NHAI",
        ISIN: "ine906b07cb9",
        Quantity: 250,
        "Purchase Price": 1012.5,
        "Current Market Price": 1045,
        "Coupon Rate": 7.1,
        "Coupon Frequency": "Half-Yearly",
        "Purchase Date": "2025-02-10",
        "Maturity Date": "2035-02-10",
      },
      {
        "Bond Name": "REC Bond 2034",
        Category: "Bonds",
        Owner: "Priyesh",
        Issuer: "REC",
        Quantity: 100,
        "Purchase Price": 998,
        "Current Market Price": 1025,
        "Coupon Rate": 7.8,
        "Coupon Frequency": "Annual",
        "Purchase Date": "2024-05-01",
        "Maturity Date": "2034-05-01",
      },
    ]);

    expect(result.records).toHaveLength(2);
    expect(result.records[0]?.action).toBe("update");
    expect(result.records[0]?.payload.id).toBe("f11eaf8a-f8a1-4ee2-a50c-45d7a1640f83");
    expect(result.records[0]?.payload.values.isin).toBe("INE906B07CB9");

    expect(result.records[1]?.action).toBe("update");
    expect(result.records[1]?.payload.id).toBe("faf9918c-2ba0-4bc9-ac5b-d5f95f08ecca");
    expect(result.records[1]?.payload.values.issuer).toBe("REC");
    expect(result.records[1]?.payload.values.bond_name).toBe("REC Bond 2034");

    const warningMessages = result.issues.filter((item) => item.severity === "warning").map((item) => item.message);
    expect(warningMessages.some((message) => message.includes("Matching Bond already exists"))).toBe(true);
    expect(warningMessages.some((message) => message.includes("ISIN is missing"))).toBe(true);
  });
});
