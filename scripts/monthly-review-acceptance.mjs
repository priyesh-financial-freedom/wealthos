import fs from "node:fs";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const authStatePath = process.env.AUTH_STATE_PATH ?? "/tmp/wealthos-auth-state.json";
const acceptanceStatePath = process.env.ACCEPTANCE_STATE_PATH ?? "/tmp/wealthos-monthly-review-state.json";
const providedEmail = process.env.ACCEPTANCE_EMAIL ?? null;
const providedPassword = process.env.ACCEPTANCE_PASSWORD ?? null;
const phaseArg = process.argv.find((arg) => arg.startsWith("--phase="));
const phase = phaseArg ? phaseArg.split("=")[1] : "pre";

const expectedValues = {
  mutualFunds: "4850000",
  stocks: "1000000",
  loan: "320000",
  asset: "250000",
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeNumberString(value) {
  const n = Number(String(value ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(n)) {
    return null;
  }
  return String(n);
}

function valuesMatch(actual, expected) {
  return normalizeNumberString(actual) === normalizeNumberString(expected);
}

function valuesSnapshotMatch(actual, expected) {
  return (
    valuesMatch(actual.mutualFunds, expected.mutualFunds)
    && valuesMatch(actual.stocks, expected.stocks)
    && valuesMatch(actual.loan, expected.loan)
    && valuesMatch(actual.asset, expected.asset)
  );
}

function tokenSub(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

async function goto(page, path) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await wait(500);
}

async function waitForAuthFormReady(page, path) {
  await goto(page, path);
  await page.locator("form[data-auth-ready='true']").first().waitFor({ timeout: 30000 });
}

async function createOrLogin(page, creds) {
  await waitForAuthFormReady(page, "/login");
  await page.fill("#email", creds.email);
  await page.fill("#password", creds.password);
  await page.getByRole("button", { name: /^Log in$/i }).click();
  await wait(2500);

  await goto(page, "/dashboard");
  const hasSessionToken = await page.evaluate(() => {
    return Object.keys(localStorage).some((key) => key.includes("auth-token") || key.includes("sb-"));
  }).catch(() => false);

  if (page.url().includes("/login") || !hasSessionToken) {
    if (!providedEmail || !providedPassword) {
      throw new Error("Unable to authenticate with provided credentials and signup fallback is disabled to avoid Supabase email rate-limit flakiness. Set ACCEPTANCE_EMAIL and ACCEPTANCE_PASSWORD.");
    }

    const snippet = (await page.locator("body").innerText()).slice(0, 500);
    throw new Error(`Unable to authenticate with ACCEPTANCE_EMAIL. Snippet: ${snippet}`);
  }
}

async function ensureInvestmentRows(page, labels) {
  await goto(page, "/investments/mutual-funds");
  if (await page.getByText(labels.mfName).count() === 0) {
    await page.getByRole("button", { name: /^Add Mutual Fund$/i }).first().click();
    await page.locator("#scheme_name").waitFor({ timeout: 30000 });
    await page.fill("#scheme_name", labels.mfName);
    await page.fill("#amc", "Acceptance AMC");
    await page.fill("#amfi_scheme_code", `AMFI-${Date.now()}`);
    await page.fill("#folio_number", `FOLIO-${Date.now()}`);
    await page.fill("#owner", "Acceptance User");
    await page.fill("#purchase_value", expectedValues.mutualFunds);
    await page.fill("#units", "1");
    await page.fill("#current_nav", expectedValues.mutualFunds);
    await page.getByRole("button", { name: /^Add Mutual Fund$/i }).last().click();
    await wait(1500);
  }

  await goto(page, "/investments/stocks");
  if (await page.getByText(labels.stockName).count() === 0) {
    await page.getByRole("button", { name: /^Add Stock$/i }).first().click();
    await page.locator("#stock_name").waitFor({ timeout: 30000 });
    await page.fill("#stock_name", labels.stockName);
    await page.fill("#isin", `INE${String(Date.now()).slice(-8)}A01`);
    await page.fill("#owner", "Acceptance User");
    await page.fill("#demat_account_number", `DEMAT${String(Date.now()).slice(-8)}`);
    await page.fill("#demat_account_provider", "Acceptance Demat");
    await page.fill("#units", "1");
    await page.fill("#average_purchase_price", expectedValues.stocks);
    await page.fill("#cost_value", expectedValues.stocks);
    await page.fill("#current_value", expectedValues.stocks);
    await page.getByRole("button", { name: /^Add Stock$/i }).last().click();
    await wait(1500);
  }
}

async function ensureAssetAndLoanRows(page, labels) {
  await goto(page, "/assets");
  if (await page.getByText(labels.assetName).count() === 0) {
    await page.getByRole("button", { name: /^Add Asset$/i }).first().click();
    await page.locator("#asset-name").waitFor({ timeout: 30000 });
    await page.fill("#asset-name", labels.assetName);
    await page.selectOption("#asset-type", "Bank Account");
    await page.fill("#asset-current-value", expectedValues.asset);
    await page.fill("#asset-growth-rate", "4");
    await page.fill("#asset-owner", "Acceptance User");
    await page.getByRole("button", { name: /^Save$/i }).click();
    await wait(1500);
  }

  await goto(page, "/liabilities");
  if (await page.getByText(labels.loanName).count() === 0) {
    await page.getByRole("button", { name: /^Add Liability$/i }).first().click();
    await page.locator("#liability_type").waitFor({ timeout: 30000 });
    await page.selectOption("#liability_type", "Home Loan");
    await page.fill("#account_name", labels.loanName);
    await page.fill("#lender", "Acceptance Bank");
    await page.fill("#outstanding_amount", expectedValues.loan);
    await page.fill("#original_amount", "450000");
    await page.fill("#interest_rate", "8.1");
    await page.fill("#emi", "25000");
    await page.fill("#tenure_months", "240");
    await page.fill("#due_day", "5");
    await page.getByRole("button", { name: /Add liability/i }).click();
    await wait(1500);
  }
}

async function readMonthlyReviewValues(page, labels) {
  const mutualFunds = await page.locator("div").filter({ hasText: "Total Mutual Fund Value" }).first().locator("input[type='number']").first().inputValue();
  const stocks = await page.locator("div").filter({ hasText: "Total Stock Portfolio Value" }).first().locator("input[type='number']").first().inputValue();
  const loan = await page.locator("div").filter({ hasText: labels.loanName }).first().locator("input[type='number']").first().inputValue();
  const asset = await page.locator("div").filter({ hasText: labels.assetName }).first().locator("input[type='number']").first().inputValue();
  return { mutualFunds, stocks, loan, asset };
}

async function collectStorageSnapshot(page, context) {
  const localStorageKeys = await page.evaluate(() => Object.keys(localStorage));
  const cookies = await context.cookies(baseUrl);
  return {
    localStorageKeys,
    cookieNames: cookies.map((cookie) => cookie.name),
  };
}

async function getDraftCount(context, authState) {
  if (!authState.supabaseOrigin || !authState.supabaseApiKey || !authState.authToken) {
    return null;
  }

  const response = await context.request.get(
    `${authState.supabaseOrigin}/rest/v1/month_end_closes?select=id&close_year=eq.2026&close_month=eq.7&status=eq.draft`,
    {
      headers: {
        apikey: authState.supabaseApiKey,
        Authorization: `Bearer ${authState.authToken}`,
      },
    },
  );

  if (!response.ok()) {
    return null;
  }

  const rows = await response.json();
  return Array.isArray(rows) ? rows.length : null;
}

function makeAuthTracker() {
  return {
    supabaseOrigin: null,
    supabaseApiKey: null,
    authToken: null,
    apiErrors: [],
    consoleErrors: [],
    pageErrors: [],
  };
}

function attachTrackers(page, tracker) {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      tracker.consoleErrors.push(msg.text());
    }
  });

  page.on("pageerror", (err) => {
    tracker.pageErrors.push(err.message);
  });

  page.on("request", (request) => {
    const url = request.url();
    if (!url.includes("/rest/v1/")) {
      return;
    }

    if (!tracker.supabaseOrigin) {
      const parsed = new URL(url);
      tracker.supabaseOrigin = `${parsed.protocol}//${parsed.host}`;
    }

    const headers = request.headers();
    if (!tracker.supabaseApiKey && headers.apikey) {
      tracker.supabaseApiKey = headers.apikey;
    }
    if (!tracker.authToken && headers.authorization?.startsWith("Bearer ")) {
      tracker.authToken = headers.authorization.slice(7);
    }
  });

  page.on("response", async (response) => {
    if (response.status() < 400) {
      return;
    }

    const url = response.url();
    if (!url.includes("/rest/v1/") && !url.includes("/api/")) {
      return;
    }

    tracker.apiErrors.push({
      status: response.status(),
      url,
      body: (await response.text().catch(() => "<unreadable>")).slice(0, 260),
    });
  });
}

async function runPrePhase() {
  const creds = providedEmail && providedPassword
    ? { email: providedEmail, password: providedPassword }
    : { email: `acceptance.monthly.review.${Date.now()}@gmail.com`, password: "WealthOS#12345" };

  const labels = {
    mfName: `AT MF ${Date.now()}`,
    stockName: `AT STOCK ${Date.now()}`,
    loanName: `AT LOAN ${Date.now()}`,
    assetName: `AT CASH BANK ${Date.now()}`,
  };

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-setuid-sandbox"],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  const tracker = makeAuthTracker();
  attachTrackers(page, tracker);

  try {
    await createOrLogin(page, creds);
    await ensureInvestmentRows(page, labels);
    await ensureAssetAndLoanRows(page, labels);

    await goto(page, "/monthly-review");
    const pendingText = (await page.getByText(/Pending close period:/i).first().textContent())?.trim() ?? "";
    const pendingIsJuly2026 = /July\s+2026/i.test(pendingText);

    await page.locator("div").filter({ hasText: "Total Mutual Fund Value" }).first().locator("input[type='number']").first().fill(expectedValues.mutualFunds);
    await page.locator("div").filter({ hasText: "Total Stock Portfolio Value" }).first().locator("input[type='number']").first().fill(expectedValues.stocks);
    await page.locator("div").filter({ hasText: labels.loanName }).first().locator("input[type='number']").first().fill(expectedValues.loan);
    await page.locator("div").filter({ hasText: labels.assetName }).first().locator("input[type='number']").first().fill(expectedValues.asset);

    const beforeSaveStorage = await collectStorageSnapshot(page, context);

    await page.getByRole("button", { name: /^Save Investment Updates$/i }).click();
    await wait(1300);
    await page.getByRole("button", { name: /^Save Asset Updates$/i }).click();
    await wait(1300);
    await page.getByRole("button", { name: /^Save Loan Updates$/i }).click();
    await wait(1800);

    const valuesAfterSave = await readMonthlyReviewValues(page, labels);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => undefined);
    const valuesAfterRefresh = await readMonthlyReviewValues(page, labels);

    await goto(page, "/dashboard");
    await page.getByRole("link", { name: /^Monthly Review$/i }).click();
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await wait(1000);
    const valuesAfterNavigation = await readMonthlyReviewValues(page, labels);

    const afterNavStorage = await collectStorageSnapshot(page, context);

    const authState = {
      supabaseOrigin: tracker.supabaseOrigin,
      supabaseApiKey: tracker.supabaseApiKey,
      authToken: tracker.authToken,
    };

    const draftCount = await getDraftCount(context, authState);
    await context.storageState({ path: authStatePath });

    const report = {
      phase: "pre",
      creds,
      labels,
      pendingText,
      pendingIsJuly2026,
      valuesAfterSave,
      valuesAfterRefresh,
      valuesAfterNavigation,
      persistedAfterRefresh: valuesSnapshotMatch(valuesAfterRefresh, expectedValues),
      persistedAfterNavigation: valuesSnapshotMatch(valuesAfterNavigation, expectedValues),
      storageBeforeSave: beforeSaveStorage,
      storageAfterNavigation: afterNavStorage,
      draftCount,
      authState,
      consoleErrors: tracker.consoleErrors,
      pageErrors: tracker.pageErrors,
      apiErrors: tracker.apiErrors,
    };

    fs.writeFileSync(acceptanceStatePath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
}

async function runPostPhase() {
  if (!fs.existsSync(acceptanceStatePath)) {
    throw new Error(`Missing pre-phase state file at ${acceptanceStatePath}`);
  }

  if (!fs.existsSync(authStatePath)) {
    throw new Error(`Missing auth storage state file at ${authStatePath}`);
  }

  const pre = JSON.parse(fs.readFileSync(acceptanceStatePath, "utf8"));
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-setuid-sandbox"],
  });
  const context = await browser.newContext({ storageState: authStatePath });
  const page = await context.newPage();

  const tracker = makeAuthTracker();
  attachTrackers(page, tracker);

  try {
    await goto(page, "/monthly-review");

    const pendingText = (await page.getByText(/Pending close period:/i).first().textContent())?.trim() ?? "";
    const valuesAfterRestart = await readMonthlyReviewValues(page, pre.labels);
    const storageAfterRestart = await collectStorageSnapshot(page, context);

    const draftCountAfterRestart = await getDraftCount(context, {
      supabaseOrigin: tracker.supabaseOrigin ?? pre.authState?.supabaseOrigin ?? null,
      supabaseApiKey: tracker.supabaseApiKey ?? pre.authState?.supabaseApiKey ?? null,
      authToken: tracker.authToken ?? pre.authState?.authToken ?? null,
    });

    const report = {
      phase: "post",
      pendingText,
      valuesAfterRestart,
      persistedAfterRestart: valuesSnapshotMatch(valuesAfterRestart, expectedValues),
      storageAfterRestart,
      draftCountAfterRestart,
      consoleErrors: tracker.consoleErrors,
      pageErrors: tracker.pageErrors,
      apiErrors: tracker.apiErrors,
    };

    fs.writeFileSync(acceptanceStatePath, JSON.stringify({ ...pre, post: report }, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
}

if (phase === "pre") {
  await runPrePhase();
} else if (phase === "post") {
  await runPostPhase();
} else {
  throw new Error(`Unknown phase '${phase}'. Use --phase=pre or --phase=post.`);
}
