import type { ProjectionContext } from "../projectionContext";

import {
  compareOpeningBalanceSnapshots,
  type OpeningBalanceAllocationItem,
  type OpeningBalanceSnapshot,
  type OpeningBalanceSnapshotComparison,
} from "./OpeningBalanceSnapshot";
import {
  OpeningBalanceRepository,
  type OpeningBalanceRepositoryContract,
} from "./Repository";
import {
  OpeningBalanceValidator,
  type OpeningBalanceValidationIssue,
} from "./Validators";
import {
  OpeningBalanceMapper,
  type OpeningBalanceSnapshotRow,
} from "./Mapper";
import type {
  OpeningBalanceBuildRequest,
  OpeningBalanceComparisonRequest,
} from "./Types";

function nowIso() {
  return new Date().toISOString();
}

function toNumber(value: number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function allocation(entries: Array<{ key: string; value: number }>, denominator: number): OpeningBalanceAllocationItem[] {
  return entries.map((entry) => ({
    key: entry.key,
    value: entry.value,
    percentage: denominator <= 0 ? 0 : (entry.value / denominator) * 100,
  }));
}

function liabilityBucket(type: string) {
  switch (type) {
    case "homeLoan":
    case "Home Loan":
    case "Loan Against Property":
      return "homeLoan";
    case "carLoan":
    case "Car Loan":
      return "carLoan";
    case "creditCards":
    case "Credit Card":
      return "creditCards";
    case "personalLoan":
    case "Personal Loan":
    case "Overdraft / Line of Credit":
      return "personalLoan";
    case "otherLiabilities":
    default:
      return "otherLiabilities";
  }
}

export class OpeningBalanceService {
  constructor(
    private readonly repository: OpeningBalanceRepositoryContract = new OpeningBalanceRepository(),
    private readonly validator: OpeningBalanceValidator = new OpeningBalanceValidator(),
    private readonly mapper: OpeningBalanceMapper = new OpeningBalanceMapper(),
  ) {}

  async buildSnapshot(
    request: OpeningBalanceBuildRequest,
    context: ProjectionContext,
  ): Promise<{ snapshot: OpeningBalanceSnapshot | null; issues: OpeningBalanceValidationIssue[] }> {
    const source = context.openingBalanceSnapshot;
    const assetsTotal = toNumber(source.sourceBalances.assets);
    const liabilitiesTotal = toNumber(source.sourceBalances.liabilities);
    const bankAccountsTotal = toNumber(source.sourceBalances.bankAccounts);
    const investmentsTotal = toNumber(source.sourceBalances.investments);
    const retirementTotal = toNumber(source.sourceBalances.retirementAccounts);
    const realEstateTotal = toNumber(source.sourceBalances.realEstate);
    const goldTotal = toNumber(source.sourceBalances.gold);
    const fixedDepositsTotal = toNumber(source.sourceBalances.fixedDeposits);
    const otherAssetsTotal = toNumber(source.sourceBalances.otherAssets);
    const cashPosition = toNumber(source.cashPosition);

    const openingAssets =
      cashPosition +
      investmentsTotal +
      retirementTotal +
      realEstateTotal +
      goldTotal +
      fixedDepositsTotal +
      otherAssetsTotal;

    const openingLiabilities = liabilitiesTotal;
    const openingNetWorth = openingAssets - openingLiabilities;
    const debtPosition = openingLiabilities;

    const liabilityBuckets = source.liabilityAllocation.reduce(
      (acc, item) => {
        const key = liabilityBucket(item.key);
        acc[key] += toNumber(item.value);
        return acc;
      },
      {
        homeLoan: 0,
        carLoan: 0,
        creditCards: 0,
        personalLoan: 0,
        otherLiabilities: 0,
      },
    );

    const snapshot: OpeningBalanceSnapshot = {
      id: request.id,
      effectiveDate: request.effectiveDate,
      version: request.version,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      isActive: request.isActive ?? true,
      futureEffectiveDate: request.futureEffectiveDate ?? null,

      openingAssets,
      openingLiabilities,
      openingNetWorth,
      cashPosition,
      retirementCorpus: retirementTotal,
      investmentCorpus: investmentsTotal,
      debtPosition,

      assetAllocation: allocation(
        [
          { key: "cashPosition", value: cashPosition },
          { key: "investmentCorpus", value: investmentsTotal },
          { key: "retirementCorpus", value: retirementTotal },
          { key: "realEstate", value: realEstateTotal },
          { key: "gold", value: goldTotal },
          { key: "fixedDeposits", value: fixedDepositsTotal },
          { key: "otherAssets", value: otherAssetsTotal },
        ],
        openingAssets,
      ),
      liabilityAllocation: allocation(
        [
          { key: "homeLoan", value: liabilityBuckets.homeLoan },
          { key: "carLoan", value: liabilityBuckets.carLoan },
          { key: "creditCards", value: liabilityBuckets.creditCards },
          { key: "personalLoan", value: liabilityBuckets.personalLoan },
          { key: "otherLiabilities", value: liabilityBuckets.otherLiabilities },
        ],
        openingLiabilities,
      ),
      sourceBalances: {
        assets: assetsTotal,
        liabilities: liabilitiesTotal,
        bankAccounts: bankAccountsTotal,
        investments: investmentsTotal,
        retirementAccounts: retirementTotal,
        realEstate: realEstateTotal,
        gold: goldTotal,
        fixedDeposits: fixedDepositsTotal,
        otherAssets: otherAssetsTotal,
      },
    };

    const issues = this.validator.validate(snapshot);
    if (issues.length > 0) {
      return { snapshot: null, issues };
    }

    const savedSnapshot = await this.repository.save(snapshot);
    return { snapshot: savedSnapshot, issues: [] };
  }

  async listVersions(snapshotId: string): Promise<OpeningBalanceSnapshot[]> {
    return this.repository.listVersions(snapshotId);
  }

  async getVersion(snapshotId: string, version: number): Promise<OpeningBalanceSnapshot | null> {
    return this.repository.getVersion(snapshotId, version);
  }

  async getActive(snapshotId: string, asOfDate?: string): Promise<OpeningBalanceSnapshot | null> {
    return this.repository.getActive(snapshotId, asOfDate);
  }

  async activateVersion(snapshotId: string, version: number): Promise<OpeningBalanceSnapshot | null> {
    return this.repository.activate(snapshotId, version);
  }

  async compareSnapshots(request: OpeningBalanceComparisonRequest): Promise<OpeningBalanceSnapshotComparison | null> {
    const previous = await this.repository.getVersion(request.previous.id, request.previous.version);
    const current = await this.repository.getVersion(request.current.id, request.current.version);

    if (!previous || !current) {
      return null;
    }

    return compareOpeningBalanceSnapshots(previous, current);
  }

  toPersistence(snapshot: OpeningBalanceSnapshot): OpeningBalanceSnapshotRow {
    return this.mapper.toRow(snapshot);
  }

  fromPersistence(row: OpeningBalanceSnapshotRow): OpeningBalanceSnapshot {
    return this.mapper.fromRow(row);
  }
}

export const openingBalanceService = new OpeningBalanceService();
