import type {
  MonthlyProjection,
  ProjectionAnalytics,
  ProjectionKPISet,
  ProjectionTrendMetrics,
  ProjectionVariance,
  VarianceInput,
} from "./types";

function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

export function calculateProjectionKPIs(months: MonthlyProjection[]): ProjectionKPISet {
  if (months.length === 0) {
    return {
      months: 0,
      endingNetWorth: 0,
      netWorthGrowth: 0,
      averageMonthlySurplus: 0,
      averageSavingsRate: 0,
      negativeCashFlowMonths: 0,
      debtToAssetRatioEnd: 0,
    };
  }

  const first = months[0];
  const last = months[months.length - 1];
  const totalNetCashFlow = months.reduce((sum, month) => sum + month.activity.netCashFlow, 0);
  const totalSavingsRate = months.reduce((sum, month) => {
    const savings = month.activity.income - month.activity.expenses;
    return sum + safeDivide(savings, month.activity.income);
  }, 0);
  const negativeCashFlowMonths = months.filter((month) => month.activity.netCashFlow < 0).length;

  return {
    months: months.length,
    endingNetWorth: last.closing.netWorth,
    netWorthGrowth: last.closing.netWorth - first.opening.netWorth,
    averageMonthlySurplus: totalNetCashFlow / months.length,
    averageSavingsRate: totalSavingsRate / months.length,
    negativeCashFlowMonths,
    debtToAssetRatioEnd: safeDivide(last.closing.liabilities, last.closing.assets),
  };
}

export function calculateProjectionVariance(input: VarianceInput): ProjectionVariance[] {
  const actualByMonth = new Map(
    input.actualProjection.map((month) => [month.monthKey, month]),
  );

  return input.baselineProjection.flatMap((baselineMonth) => {
    const actualMonth = actualByMonth.get(baselineMonth.monthKey);
    if (!actualMonth) {
      return [];
    }

    return {
      monthKey: baselineMonth.monthKey,
      cashVariance: actualMonth.closing.cash - baselineMonth.closing.cash,
      investmentVariance:
        actualMonth.closing.investments - baselineMonth.closing.investments,
      liabilityVariance:
        actualMonth.closing.liabilities - baselineMonth.closing.liabilities,
      netWorthVariance: actualMonth.closing.netWorth - baselineMonth.closing.netWorth,
      incomeVariance: actualMonth.activity.income - baselineMonth.activity.income,
      expenseVariance: actualMonth.activity.expenses - baselineMonth.activity.expenses,
      contributionVariance:
        actualMonth.activity.contribution - baselineMonth.activity.contribution,
      growthVariance:
        actualMonth.activity.investmentGrowth
        - baselineMonth.activity.investmentGrowth,
    };
  });
}

export function calculateAchievementPercent(months: MonthlyProjection[]): number {
  if (months.length === 0) {
    return 0;
  }

  const positiveMonths = months.filter((month) => month.activity.netCashFlow >= 0).length;
  return safeDivide(positiveMonths, months.length) * 100;
}

export function calculateTrendMetrics(months: MonthlyProjection[]): ProjectionTrendMetrics[] {
  return months.map((month) => ({
    monthKey: month.monthKey,
    netWorth: month.closing.netWorth,
    netCashFlow: month.activity.netCashFlow,
    debtToAssetRatio: safeDivide(month.closing.liabilities, month.closing.assets),
  }));
}

export class ProjectionAnalyticsService {
  calculateKPIs(months: MonthlyProjection[]): ProjectionKPISet {
    return calculateProjectionKPIs(months);
  }

  calculateVariance(input: VarianceInput): ProjectionVariance[] {
    return calculateProjectionVariance(input);
  }

  calculateAchievementPercent(months: MonthlyProjection[]): number {
    return calculateAchievementPercent(months);
  }

  calculateTrendMetrics(months: MonthlyProjection[]): ProjectionTrendMetrics[] {
    return calculateTrendMetrics(months);
  }

  summarize(input: {
    projection: MonthlyProjection[];
    baselineProjection?: MonthlyProjection[];
  }): ProjectionAnalytics {
    const variance = input.baselineProjection
      ? this.calculateVariance({
          baselineProjection: input.baselineProjection,
          actualProjection: input.projection,
        })
      : [];

    return {
      kpis: this.calculateKPIs(input.projection),
      variance,
      achievementPercent: this.calculateAchievementPercent(input.projection),
      trendMetrics: this.calculateTrendMetrics(input.projection),
    };
  }
}

export const projectionAnalyticsService = new ProjectionAnalyticsService();