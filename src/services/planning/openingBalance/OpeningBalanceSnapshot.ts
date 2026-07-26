type ISODateString = string;
type ISODateTimeString = string;

export interface OpeningBalanceAllocationItem {
  key: string;
  value: number;
  percentage: number;
}

export interface OpeningBalanceSourceBalances {
  assets: number;
  liabilities: number;
  bankAccounts: number;
  investments: number;
  retirementAccounts: number;
  realEstate: number;
  gold: number;
  fixedDeposits: number;
  otherAssets: number;
}

export interface OpeningBalanceSnapshot {
  id: string;
  effectiveDate: ISODateString;
  version: number;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
  isActive: boolean;
  futureEffectiveDate: ISODateString | null;

  openingAssets: number;
  openingLiabilities: number;
  openingNetWorth: number;
  cashPosition: number;
  retirementCorpus: number;
  investmentCorpus: number;
  debtPosition: number;

  assetAllocation: OpeningBalanceAllocationItem[];
  liabilityAllocation: OpeningBalanceAllocationItem[];
  sourceBalances: OpeningBalanceSourceBalances;
}

export interface OpeningBalanceMetricDelta {
  previous: number;
  current: number;
  absoluteChange: number;
  percentageChange: number | null;
}

export interface OpeningBalanceSnapshotComparison {
  previousSnapshotId: string;
  previousVersion: number;
  currentSnapshotId: string;
  currentVersion: number;
  metrics: {
    openingAssets: OpeningBalanceMetricDelta;
    openingLiabilities: OpeningBalanceMetricDelta;
    openingNetWorth: OpeningBalanceMetricDelta;
    cashPosition: OpeningBalanceMetricDelta;
    retirementCorpus: OpeningBalanceMetricDelta;
    investmentCorpus: OpeningBalanceMetricDelta;
    debtPosition: OpeningBalanceMetricDelta;
  };
}

function buildDelta(previous: number, current: number): OpeningBalanceMetricDelta {
  const absoluteChange = current - previous;
  const percentageChange = previous === 0 ? (current === 0 ? 0 : null) : (absoluteChange / Math.abs(previous)) * 100;

  return {
    previous,
    current,
    absoluteChange,
    percentageChange,
  };
}

export function compareOpeningBalanceSnapshots(
  previous: OpeningBalanceSnapshot,
  current: OpeningBalanceSnapshot,
): OpeningBalanceSnapshotComparison {
  return {
    previousSnapshotId: previous.id,
    previousVersion: previous.version,
    currentSnapshotId: current.id,
    currentVersion: current.version,
    metrics: {
      openingAssets: buildDelta(previous.openingAssets, current.openingAssets),
      openingLiabilities: buildDelta(previous.openingLiabilities, current.openingLiabilities),
      openingNetWorth: buildDelta(previous.openingNetWorth, current.openingNetWorth),
      cashPosition: buildDelta(previous.cashPosition, current.cashPosition),
      retirementCorpus: buildDelta(previous.retirementCorpus, current.retirementCorpus),
      investmentCorpus: buildDelta(previous.investmentCorpus, current.investmentCorpus),
      debtPosition: buildDelta(previous.debtPosition, current.debtPosition),
    },
  };
}