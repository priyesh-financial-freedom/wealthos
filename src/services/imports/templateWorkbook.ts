import * as XLSX from "xlsx";

interface ImportTemplateSheetDefinition {
  sheetName: string;
  headers: string[];
  sampleRow: Array<string | number | boolean | null>;
}

const importTemplateSheets: ImportTemplateSheetDefinition[] = [
  {
    sheetName: "Bank Accounts",
    headers: [
      "Bank Name",
      "Account Name",
      "Account Number",
      "Latest Balance",
      "Opening Balance",
      "Account Type",
      "Status",
      "Currency",
      "Interest Rate",
      "Owner",
      "Nominee",
      "IFSC",
      "Notes",
      "ID",
    ],
    sampleRow: [
      "HDFC Bank",
      "Salary Account",
      "1234567890",
      250000,
      200000,
      "Salary",
      "active",
      "INR",
      3.5,
      "Priyesh",
      "Spouse",
      "HDFC0000123",
      "Primary salary account",
      null,
    ],
  },
  {
    sheetName: "MF Holdings",
    headers: [
      "Investment Name",
      "Category",
      "Owner",
      "Nominee",
      "Folio Number",
      "AMFI Scheme Code",
      "Investment Mode",
      "Option Type",
      "Broker Platform",
      "Units",
      "NAV Price",
      "Cost Basis",
      "SIP Amount",
      "SIP Date",
      "Region",
      "Purchase Date",
      "Today Gain Loss",
      "Sector",
      "AMC",
      "Notes",
      "ID",
    ],
    sampleRow: [
      "HDFC Flexi Cap Fund",
      "Mutual Funds",
      "Priyesh",
      "Spouse",
      "1234567/89",
      "120503",
      "Direct",
      "Growth",
      "Groww",
      1250.75,
      72.35,
      78000,
      5000,
      5,
      "Domestic",
      "2024-04-15",
      320,
      "Diversified",
      "HDFC AMC",
      "SIP holding",
      null,
    ],
  },
  {
    sheetName: "Stock Holdings",
    headers: [
      "Investment Name",
      "Owner",
      "Category",
      "Units",
      "Average Purchase Price",
      "Current Price",
      "Broker",
      "Sector",
      "Exchange",
      "ISIN",
      "Purchase Date",
      "Notes",
      "ID",
    ],
    sampleRow: [
      "TCS",
      "Priyesh",
      "Stocks",
      24,
      3604.17,
      4120,
      "Zerodha",
      "IT",
      "NSE",
      "INE467B01029",
      "2023-11-02",
      "Long-term core equity",
      null,
    ],
  },
  {
    sheetName: "PPF Accounts",
    headers: [
      "Owner",
      "Institution",
      "Current Balance",
      "Contribution Frequency",
      "Contribution Amount",
      "Contribution Day",
      "Contribution Month",
      "Account Number",
      "Opening Date",
      "Interest Rate",
      "Maturity Date",
      "Nominee",
      "Notes",
      "ID",
    ],
    sampleRow: [
      "Priyesh",
      "State Bank of India",
      545000,
      "Annual",
      150000,
      5,
      "April",
      "PPF123456",
      "2018-05-01",
      7.1,
      "2033-05-01",
      "Spouse",
      "PPF long-term corpus",
      null,
    ],
  },
  {
    sheetName: "EPF Accounts",
    headers: [
      "Owner",
      "Institution",
      "Current Balance",
      "Contribution Frequency",
      "Contribution Amount",
      "Contribution Day",
      "Account Number",
      "Opening Date",
      "Interest Rate",
      "Employer",
      "UAN",
      "Employee Contribution",
      "Employer Contribution",
      "Nominee",
      "Notes",
      "ID",
    ],
    sampleRow: [
      "Priyesh",
      "EPFO",
      1245000,
      "Monthly",
      18000,
      30,
      "EPF-001",
      "2016-08-01",
      8.25,
      "Acme Technologies",
      "100200300400",
      9000,
      9000,
      "Spouse",
      "Payroll-linked EPF account",
      null,
    ],
  },
  {
    sheetName: "NPS Accounts",
    headers: [
      "Owner",
      "Institution",
      "Current Balance",
      "Contribution Frequency",
      "Contribution Amount",
      "Contribution Day",
      "Account Number",
      "Opening Date",
      "Interest Rate",
      "PRAN",
      "POP",
      "Equity %",
      "Corporate Debt %",
      "Government Securities %",
      "Alternative Assets %",
      "Nominee",
      "Notes",
      "ID",
    ],
    sampleRow: [
      "Priyesh",
      "NPS Trust",
      820000,
      "Monthly",
      10000,
      10,
      "NPS-001",
      "2019-04-10",
      null,
      "123456789012",
      "eNPS",
      70,
      15,
      10,
      5,
      "Spouse",
      "Active NPS Tier-I",
      null,
    ],
  },
  {
    sheetName: "Loan Inputs",
    headers: [
      "Liability Type",
      "Lender",
      "Account Name",
      "Outstanding Amount",
      "Original Amount",
      "Interest Rate",
      "EMI",
      "Start Date",
      "End Date",
      "Due Day",
      "Due Date",
      "Tenure Months",
      "Credit Limit",
      "Sanction Limit",
      "Status",
      "Notes",
      "ID",
    ],
    sampleRow: [
      "Home Loan",
      "ICICI Bank",
      "Primary Home Loan",
      3450000,
      4200000,
      8.4,
      38250,
      "2021-02-10",
      "2041-02-10",
      5,
      null,
      240,
      null,
      null,
      "active",
      "Floating ROI",
      null,
    ],
  },
  {
    sheetName: "Health Insurance",
    headers: [
      "Policy Name",
      "Provider",
      "Owner",
      "Nominee",
      "Status",
      "Opening Value",
      "Current Value",
      "Start Date",
      "Maturity Date",
      "Notes",
      "ID",
    ],
    sampleRow: [
      "Family Floater",
      "Star Health",
      "Priyesh",
      "Spouse",
      "active",
      2000000,
      2000000,
      "2025-01-01",
      "2025-12-31",
      "Annual family floater cover",
      null,
    ],
  },
  {
    sheetName: "Life Insurance",
    headers: [
      "Policy Name",
      "Provider",
      "Owner",
      "Nominee",
      "Status",
      "Opening Value",
      "Current Value",
      "Start Date",
      "Maturity Date",
      "Notes",
      "ID",
    ],
    sampleRow: [
      "Term Life Cover",
      "LIC",
      "Priyesh",
      "Spouse",
      "active",
      10000000,
      10000000,
      "2022-08-01",
      "2052-08-01",
      "Pure term plan",
      null,
    ],
  },
  {
    sheetName: "Fixed Deposits",
    headers: [
      "Deposit Type",
      "Institution",
      "Account Number",
      "Holder",
      "Principal",
      "Interest Rate",
      "Current Value",
      "Compounding Frequency",
      "Opening Date",
      "Maturity Date",
      "Auto Renew",
      "Branch",
      "Owner",
      "Nominee",
      "Notes",
      "ID",
    ],
    sampleRow: [
      "FD",
      "Axis Bank",
      "FD987654",
      "Priyesh",
      500000,
      7.35,
      546200,
      "quarterly",
      "2023-06-15",
      "2026-06-15",
      true,
      "Bangalore Main",
      "Priyesh",
      "Spouse",
      "3-year FD",
      null,
    ],
  },
  {
    sheetName: "Gold",
    headers: [
      "Holding Type",
      "Description",
      "Quantity",
      "Unit",
      "Cost Basis",
      "Current Value",
      "Purchase Date",
      "Purity",
      "Custodian",
      "Institution",
      "Owner",
      "Nominee",
      "Notes",
      "ID",
    ],
    sampleRow: [
      "Physical Gold",
      "22K coins",
      120,
      "g",
      650000,
      810000,
      "2020-10-20",
      "22K",
      "Home Locker",
      null,
      "Priyesh",
      "Spouse",
      "Festival purchases",
      null,
    ],
  },
  {
    sheetName: "Silver",
    headers: [
      "Holding Type",
      "Description",
      "Quantity",
      "Unit",
      "Cost Basis",
      "Current Value",
      "Purchase Date",
      "Purity",
      "Custodian",
      "Institution",
      "Owner",
      "Nominee",
      "Notes",
      "ID",
    ],
    sampleRow: [
      "Physical Silver",
      "Silver bars",
      1500,
      "g",
      98000,
      124000,
      "2021-07-05",
      "999",
      "Home Locker",
      null,
      "Priyesh",
      "Spouse",
      "Hedge allocation",
      null,
    ],
  },
  {
    sheetName: "Real Estate",
    headers: [
      "Property Name",
      "Property Type",
      "Owner",
      "Purchase Date",
      "Purchase Price",
      "Current Market Value",
      "Address",
      "City",
      "State",
      "PIN Code",
      "Self Occupied / Rented",
      "Monthly Rent",
      "Linked Home Loan ID",
      "Notes",
      "ID",
    ],
    sampleRow: [
      "Lakeview Residency",
      "Apartment",
      "Priyesh",
      "2020-08-12",
      7800000,
      11200000,
      "Tower 3, Whitefield Main Road",
      "Bengaluru",
      "Karnataka",
      "560066",
      "rented",
      42000,
      null,
      "Primary rental property",
      null,
    ],
  },
];

function createTemplateWorkbook() {
  const workbook = XLSX.utils.book_new();

  for (const sheet of importTemplateSheets) {
    const rows = [sheet.headers, sheet.sampleRow];
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.sheetName);
  }

  return workbook;
}

function createTemplateWorkbookForSheets(sheetNames: string[]) {
  const workbook = XLSX.utils.book_new();
  const selected = new Set(sheetNames);

  for (const sheet of importTemplateSheets) {
    if (!selected.has(sheet.sheetName)) {
      continue;
    }

    const rows = [sheet.headers, sheet.sampleRow];
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.sheetName);
  }

  return workbook;
}

function downloadWorkbook(workbook: XLSX.WorkBook, fileName: string) {
  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([output], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export function downloadImportTemplateWorkbook() {
  const workbook = createTemplateWorkbook();
  downloadWorkbook(workbook, "wealthos-import-template.xlsx");
}

export function downloadPpfImportTemplateWorkbook() {
  const workbook = createTemplateWorkbookForSheets(["PPF Accounts"]);
  downloadWorkbook(workbook, "wealthos-ppf-import-template.xlsx");
}

export function downloadEpfImportTemplateWorkbook() {
  const workbook = createTemplateWorkbookForSheets(["EPF Accounts"]);
  downloadWorkbook(workbook, "wealthos-epf-import-template.xlsx");
}

export function downloadNpsImportTemplateWorkbook() {
  const workbook = createTemplateWorkbookForSheets(["NPS Accounts"]);
  downloadWorkbook(workbook, "wealthos-nps-import-template.xlsx");
}
