export interface ProjectionState {
  cash: number;
  assets: number;
  liabilities: number;
  investments: number;
  retirement: number;
  emergencyFund: number;
  loanOutstanding: number;
  income: number;
  expenses: number;
  tax: number;
  goalFunding: number;
  netWorth: number;
}

export interface ProjectionStateSnapshot extends ProjectionState {
  monthKey: string;
  step: string;
  index: number;
  recordedAt: string;
  sequence: number;
  processor: string;
  rule: string | null;
  timestamp: string;
}

export type ProjectionStatePatch = Partial<ProjectionState>;
