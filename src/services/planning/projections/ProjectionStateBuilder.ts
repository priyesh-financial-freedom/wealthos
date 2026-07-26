import type {
  ProjectionState,
  ProjectionStatePatch,
  ProjectionStateSnapshot,
} from "./ProjectionState";

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export class ProjectionStateBuilder {
  create(initial?: ProjectionStatePatch): ProjectionState {
    return {
      cash: toNumber(initial?.cash),
      assets: toNumber(initial?.assets),
      liabilities: toNumber(initial?.liabilities),
      investments: toNumber(initial?.investments),
      retirement: toNumber(initial?.retirement),
      emergencyFund: toNumber(initial?.emergencyFund),
      loanOutstanding: toNumber(initial?.loanOutstanding),
      income: toNumber(initial?.income),
      expenses: toNumber(initial?.expenses),
      tax: toNumber(initial?.tax),
      goalFunding: toNumber(initial?.goalFunding),
      netWorth: toNumber(initial?.netWorth),
    };
  }

  clone(state: ProjectionState): ProjectionState {
    return {
      cash: toNumber(state.cash),
      assets: toNumber(state.assets),
      liabilities: toNumber(state.liabilities),
      investments: toNumber(state.investments),
      retirement: toNumber(state.retirement),
      emergencyFund: toNumber(state.emergencyFund),
      loanOutstanding: toNumber(state.loanOutstanding),
      income: toNumber(state.income),
      expenses: toNumber(state.expenses),
      tax: toNumber(state.tax),
      goalFunding: toNumber(state.goalFunding),
      netWorth: toNumber(state.netWorth),
    };
  }

  applyPatch(state: ProjectionState, patch: ProjectionStatePatch): ProjectionState {
    state.cash = toNumber(patch.cash ?? state.cash);
    state.assets = toNumber(patch.assets ?? state.assets);
    state.liabilities = toNumber(patch.liabilities ?? state.liabilities);
    state.investments = toNumber(patch.investments ?? state.investments);
    state.retirement = toNumber(patch.retirement ?? state.retirement);
    state.emergencyFund = toNumber(patch.emergencyFund ?? state.emergencyFund);
    state.loanOutstanding = toNumber(patch.loanOutstanding ?? state.loanOutstanding);
    state.income = toNumber(patch.income ?? state.income);
    state.expenses = toNumber(patch.expenses ?? state.expenses);
    state.tax = toNumber(patch.tax ?? state.tax);
    state.goalFunding = toNumber(patch.goalFunding ?? state.goalFunding);
    state.netWorth = toNumber(patch.netWorth ?? state.netWorth);
    return state;
  }

  snapshot(params: {
    state: ProjectionState;
    monthKey: string;
    step: string;
    index: number;
    recordedAt: string;
    sequence: number;
    processor: string;
    rule?: string | null;
    timestamp?: string;
  }): ProjectionStateSnapshot {
    return {
      ...this.clone(params.state),
      monthKey: params.monthKey,
      step: params.step,
      index: params.index,
      recordedAt: params.recordedAt,
      sequence: params.sequence,
      processor: params.processor,
      rule: params.rule ?? null,
      timestamp: params.timestamp ?? params.recordedAt,
    };
  }
}

export const projectionStateBuilder = new ProjectionStateBuilder();
