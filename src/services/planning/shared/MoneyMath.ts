function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export class MoneyMath {
  static round(value: unknown, decimals = 2): number {
    const factor = 10 ** decimals;
    return Math.round((toNumber(value) + Number.EPSILON) * factor) / factor;
  }

  static add(...values: Array<number | null | undefined>): number {
    return MoneyMath.round(values.reduce((sum: number, value) => sum + toNumber(value), 0));
  }

  static subtract(minuend: unknown, subtrahend: unknown): number {
    return MoneyMath.round(toNumber(minuend) - toNumber(subtrahend));
  }

  static multiply(left: unknown, right: unknown): number {
    return MoneyMath.round(toNumber(left) * toNumber(right));
  }

  static divide(numerator: unknown, denominator: unknown): number {
    const divisor = toNumber(denominator);
    if (divisor === 0) {
      return 0;
    }

    return MoneyMath.round(toNumber(numerator) / divisor);
  }

  static annualToMonthly(annualAmount: unknown): number {
    return MoneyMath.divide(annualAmount, 12);
  }
}
