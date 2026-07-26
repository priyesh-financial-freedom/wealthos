import {
  createInvestment,
  deleteInvestment,
  getInvestments,
  updateInvestment,
} from "@/services/investments";
import type {
  Investment,
  InvestmentInsert,
  InvestmentStatus,
  InvestmentUpdate,
  StockBusinessKey,
} from "@/types/investment";

export interface StockCreateInput {
  investment_name: string;
  owner: string;
  demat_account_number: string;
  isin: string;
  institution?: string | null;
  broker?: string | null;
  exchange?: string | null;
  demat_account_provider?: string | null;
  acquisition_date?: string | null;
  cost_value?: number;
  current_value?: number;
  average_purchase_price?: number | null;
  units?: number;
  status?: InvestmentStatus;
  notes?: string | null;
  documents_placeholder?: string | null;
  sector?: string | null;
}

export interface StockUpdateInput extends Partial<StockCreateInput> {
  id: string;
}

export interface StockListFilters {
  owner?: string;
  demat_account_number?: string;
  isin?: string;
  status?: InvestmentStatus;
}

function normalizeBusinessKey(input: StockBusinessKey): StockBusinessKey {
  return {
    owner: input.owner.trim(),
    demat_account_number: input.demat_account_number.trim(),
    isin: input.isin.trim().toUpperCase(),
  };
}

function assertBusinessKey(input: StockBusinessKey) {
  const normalized = normalizeBusinessKey(input);

  if (!normalized.owner) {
    throw new Error("Owner is required for stock business key.");
  }

  if (!normalized.demat_account_number) {
    throw new Error("Demat account number is required for stock business key.");
  }

  if (!normalized.isin) {
    throw new Error("ISIN is required for stock business key.");
  }

  return normalized;
}

function isMatchingBusinessKey(stock: Investment, key: StockBusinessKey) {
  const stockOwner = (stock.owner ?? "").trim().toLowerCase();
  const stockDemat = (stock.demat_account_number ?? "").trim().toLowerCase();
  const stockIsin = (stock.isin ?? "").trim().toUpperCase();

  return (
    stockOwner === key.owner.trim().toLowerCase()
    && stockDemat === key.demat_account_number.trim().toLowerCase()
    && stockIsin === key.isin.trim().toUpperCase()
  );
}

function toStockInsertPayload(input: StockCreateInput): InvestmentInsert {
  const owner = input.owner.trim();
  const dematAccountNumber = input.demat_account_number.trim();
  const isin = input.isin.trim().toUpperCase();

  if (!input.investment_name.trim()) {
    throw new Error("Stock name is required.");
  }

  if (!owner) {
    throw new Error("Owner is required.");
  }

  if (!dematAccountNumber) {
    throw new Error("Demat account number is required.");
  }

  if (!isin) {
    throw new Error("ISIN is required.");
  }

  return {
    category: "Stocks",
    investment_type: "Stocks",
    investment_name: input.investment_name.trim(),
    owner,
    demat_account_number: dematAccountNumber,
    demat_account_provider: input.demat_account_provider?.trim() || null,
    institution: input.institution?.trim() || input.broker?.trim() || null,
    broker: input.broker?.trim() || null,
    exchange: input.exchange?.trim() || null,
    isin,
    acquisition_date: input.acquisition_date || null,
    purchase_date: input.acquisition_date || null,
    cost_value: input.cost_value ?? 0,
    current_value: input.current_value ?? input.cost_value ?? 0,
    average_purchase_price: input.average_purchase_price ?? null,
    units: input.units ?? 0,
    nav_price:
      input.units && input.units > 0
        ? Number(((input.current_value ?? input.cost_value ?? 0) / input.units).toFixed(4))
        : 0,
    status: input.status ?? "active",
    notes: input.notes ?? null,
    documents_placeholder: input.documents_placeholder ?? null,
    sector: input.sector ?? null,
  };
}

function toStockUpdatePayload(input: StockUpdateInput): InvestmentUpdate {
  const payload: InvestmentUpdate = {
    id: input.id,
    category: "Stocks",
    investment_type: "Stocks",
  };

  if (input.investment_name !== undefined) {
    payload.investment_name = input.investment_name.trim();
  }
  if (input.owner !== undefined) {
    payload.owner = input.owner.trim();
  }
  if (input.demat_account_number !== undefined) {
    payload.demat_account_number = input.demat_account_number.trim();
  }
  if (input.demat_account_provider !== undefined) {
    payload.demat_account_provider = input.demat_account_provider?.trim() || null;
  }
  if (input.institution !== undefined) {
    payload.institution = input.institution?.trim() || null;
  }
  if (input.broker !== undefined) {
    payload.broker = input.broker?.trim() || null;
  }
  if (input.exchange !== undefined) {
    payload.exchange = input.exchange?.trim() || null;
  }
  if (input.isin !== undefined) {
    payload.isin = input.isin.trim().toUpperCase();
  }
  if (input.acquisition_date !== undefined) {
    payload.acquisition_date = input.acquisition_date;
    payload.purchase_date = input.acquisition_date;
  }
  if (input.cost_value !== undefined) {
    payload.cost_value = input.cost_value;
  }
  if (input.current_value !== undefined) {
    payload.current_value = input.current_value;
  }
  if (input.average_purchase_price !== undefined) {
    payload.average_purchase_price = input.average_purchase_price;
  }
  if (input.units !== undefined) {
    payload.units = input.units;
  }
  if (input.units !== undefined || input.current_value !== undefined) {
    const units = input.units ?? 0;
    const current = input.current_value ?? 0;
    payload.nav_price = units > 0 ? Number((current / units).toFixed(4)) : 0;
  }
  if (input.status !== undefined) {
    payload.status = input.status;
  }
  if (input.notes !== undefined) {
    payload.notes = input.notes;
  }
  if (input.documents_placeholder !== undefined) {
    payload.documents_placeholder = input.documents_placeholder;
  }
  if (input.sector !== undefined) {
    payload.sector = input.sector;
  }

  return payload;
}

export async function listStocks(filters?: StockListFilters): Promise<Investment[]> {
  const investments = await getInvestments();

  const stocks = investments.filter((item) => item.investment_type === "Stocks");
  if (!filters) {
    return stocks;
  }

  return stocks.filter((stock) => {
    if (filters.owner && stock.owner !== filters.owner) {
      return false;
    }

    if (filters.demat_account_number && stock.demat_account_number !== filters.demat_account_number) {
      return false;
    }

    if (filters.status && stock.status !== filters.status) {
      return false;
    }

    if (filters.isin && (stock.isin ?? "").trim().toUpperCase() !== filters.isin.trim().toUpperCase()) {
      return false;
    }

    return true;
  });
}

export async function getStockById(id: string): Promise<Investment | null> {
  const stocks = await listStocks();
  return stocks.find((item) => item.id === id) ?? null;
}

export async function getStockByBusinessKey(key: StockBusinessKey): Promise<Investment | null> {
  const normalized = assertBusinessKey(key);
  const stocks = await listStocks();
  return stocks.find((stock) => isMatchingBusinessKey(stock, normalized)) ?? null;
}

export async function createStock(input: StockCreateInput): Promise<Investment> {
  return createInvestment(toStockInsertPayload(input));
}

export async function updateStock(input: StockUpdateInput): Promise<Investment> {
  return updateInvestment(toStockUpdatePayload(input));
}

export async function upsertStockByBusinessKey(params: {
  businessKey: StockBusinessKey;
  payload: Omit<StockCreateInput, "owner" | "demat_account_number" | "isin">;
}): Promise<Investment> {
  const businessKey = assertBusinessKey(params.businessKey);
  const existing = await getStockByBusinessKey(businessKey);

  if (existing) {
    return updateStock({
      id: existing.id,
      owner: businessKey.owner,
      demat_account_number: businessKey.demat_account_number,
      isin: businessKey.isin,
      ...params.payload,
    });
  }

  return createStock({
    owner: businessKey.owner,
    demat_account_number: businessKey.demat_account_number,
    isin: businessKey.isin,
    ...params.payload,
  });
}

export async function deleteStockById(id: string): Promise<void> {
  await deleteInvestment(id);
}

export async function deleteStockByBusinessKey(key: StockBusinessKey): Promise<void> {
  const existing = await getStockByBusinessKey(key);
  if (!existing) {
    return;
  }

  await deleteInvestment(existing.id);
}

export async function listStockOwnershipDimensions(): Promise<Array<{ owner: string; demat_account_provider: string | null; demat_account_number: string }>> {
  const stocks = await listStocks();
  const unique = new Map<string, { owner: string; demat_account_provider: string | null; demat_account_number: string }>();

  for (const stock of stocks) {
    const owner = (stock.owner ?? "").trim();
    const dematNumber = (stock.demat_account_number ?? "").trim();
    if (!owner || !dematNumber) {
      continue;
    }

    const provider = stock.demat_account_provider?.trim() || null;
    const key = `${owner.toLowerCase()}::${dematNumber.toLowerCase()}`;

    if (!unique.has(key)) {
      unique.set(key, {
        owner,
        demat_account_provider: provider,
        demat_account_number: dematNumber,
      });
    }
  }

  return Array.from(unique.values()).sort((left, right) => {
    if (left.owner !== right.owner) {
      return left.owner.localeCompare(right.owner);
    }

    return left.demat_account_number.localeCompare(right.demat_account_number);
  });
}
