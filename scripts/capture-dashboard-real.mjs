import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const outDir = path.resolve("artifacts/screenshots");
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  { name: "dashboard-real-1440-desktop.png", width: 1440, height: 1120 },
  { name: "dashboard-real-1280-desktop.png", width: 1280, height: 1024 },
  { name: "dashboard-real-1024-desktop.png", width: 1024, height: 980 },
  { name: "dashboard-real-tablet.png", width: 834, height: 1194 },
];

const consoleErrors = [];
const pageErrors = [];

async function waitForHealthyDashboard(page) {
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });

  const requiredHeadings = [
    "Financial Health Score",
    "Current Position",
    "Recommended Actions",
    "Portfolio Snapshot",
    "Asset Allocation Drift",
    "Debt Snapshot",
    "Retirement Readiness",
    "Upcoming Financial Events",
  ];

  const timeoutMs = 90000;
  const start = Date.now();

  // Wait for skeletons to disappear and core widgets to render.
  while (Date.now() - start < timeoutMs) {
    const pulseCount = await page.locator(".animate-pulse").count();
    const missing = [];

    for (const heading of requiredHeadings) {
      const visible = await page.getByText(heading, { exact: false }).first().isVisible().catch(() => false);
      if (!visible) {
        missing.push(heading);
      }
    }

    if (pulseCount === 0 && missing.length === 0) {
      await page.waitForTimeout(1500);
      return;
    }

    await page.waitForTimeout(700);
  }

  throw new Error("Dashboard did not reach a fully rendered state before timeout.");
}

async function addAsset(page) {
  await page.goto(`${baseUrl}/assets`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Add Asset" }).first().click();
  await page.fill("#asset-name", "North Star Cash Reserve");
  await page.selectOption("#asset-type", "Bank Account");
  await page.fill("#asset-current-value", "1250000");
  await page.fill("#asset-growth-rate", "4");
  await page.fill("#asset-owner", "Executive Team");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForTimeout(1200);
}

async function addLiability(page) {
  await page.goto(`${baseUrl}/liabilities`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Add Liability" }).first().click();
  await page.selectOption("#liability_type", "Home Loan");
  await page.fill("#account_name", "Primary Residence Loan");
  await page.fill("#lender", "Global Bank");
  await page.fill("#outstanding_amount", "350000");
  await page.fill("#original_amount", "500000");
  await page.fill("#interest_rate", "8.25");
  await page.fill("#emi", "24000");
  await page.fill("#tenure_months", "240");
  await page.fill("#due_day", "5");
  await page.getByRole("button", { name: "Add liability" }).click();
  await page.waitForTimeout(1400);
}

async function addRetirement(page) {
  await page.goto(`${baseUrl}/retirement`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Add Retirement Account" }).first().click();
  await page.selectOption("#account_type", "PPF");
  await page.fill("#owner", "Executive Team");
  await page.fill("#institution", "National Savings Bank");
  await page.fill("#current_balance", "500000");
  await page.selectOption("#contribution_frequency", "Monthly");
  await page.fill("#contribution_amount", "15000");
  await page.fill("#contribution_day", "7");
  await page.fill("#interest_rate", "7.1");
  await page.getByRole("button", { name: "Add retirement account" }).click();
  await page.waitForTimeout(1400);
}

async function ensureAuthenticatedAndSeeded(page) {
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });

  if (page.url().includes("/login")) {
    const email = `northstar.review.${Date.now()}@example.com`;
    const password = "WealthOS#12345";

    await page.goto(`${baseUrl}/register`, { waitUntil: "domcontentloaded" });
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.fill("#confirmPassword", password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForTimeout(3000);

    if (!page.url().includes("/dashboard")) {
      await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
      await page.fill("#email", email);
      await page.fill("#password", password);
      await page.getByRole("button", { name: "Log in" }).click();
      await page.waitForTimeout(3000);
    }
  }

  await addAsset(page);
  await addLiability(page);
  await addRetirement(page);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

page.on("console", (msg) => {
  if (msg.type() === "error") {
    consoleErrors.push(msg.text());
  }
});

page.on("pageerror", (err) => {
  pageErrors.push(err.message);
});

try {
  await ensureAuthenticatedAndSeeded(page);
  await waitForHealthyDashboard(page);

  const placeholders = await page.getByText("Coming Soon", { exact: false }).count();
  if (placeholders > 0) {
    throw new Error(`Found ${placeholders} placeholder(s) with 'Coming Soon' text.`);
  }

  for (const target of targets) {
    await page.setViewportSize({ width: target.width, height: target.height });
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
    await waitForHealthyDashboard(page);
    await page.screenshot({ path: path.join(outDir, target.name), fullPage: true });
    console.log(`captured ${target.name}`);
  }

  if (consoleErrors.length > 0 || pageErrors.length > 0) {
    console.log("console-errors:", JSON.stringify(consoleErrors, null, 2));
    console.log("page-errors:", JSON.stringify(pageErrors, null, 2));
    throw new Error("Console or page errors detected during capture.");
  }

  console.log("capture-complete");
} finally {
  await browser.close();
}
