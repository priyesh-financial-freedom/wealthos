import { describe, expect, it } from "vitest";

import { SalaryProjectionService } from "./SalaryProjectionService";

describe("SalaryProjectionService", () => {
  const service = new SalaryProjectionService();

  it("keeps salary constant before increment month", () => {
    const curve = service.buildMonthlyCurve({
      startMonth: "2026-07",
      endMonth: "2027-02",
      currentGrossSalary: 100000,
      currentBasicSalary: 40000,
      annualIncrementPercent: 10,
      incrementMonth: 4,
      retirementMonth: null,
      source: "FIXED_LOCKED",
    });

    const july = curve.find((row) => row.month_key === "2026-07");
    const feb = curve.find((row) => row.month_key === "2027-02");

    expect(july?.gross_salary).toBe(100000);
    expect(feb?.gross_salary).toBe(100000);
    expect(july?.basic_salary).toBe(40000);
    expect(feb?.basic_salary).toBe(40000);
  });

  it("applies annual increment with fixed percentage", () => {
    const curve = service.buildMonthlyCurve({
      startMonth: "2026-07",
      endMonth: "2028-08",
      currentGrossSalary: 100000,
      currentBasicSalary: 40000,
      annualIncrementPercent: 10,
      incrementMonth: 7,
      retirementMonth: null,
      source: "FIXED_LOCKED",
    });

    const yearOne = curve.find((row) => row.month_key === "2027-07");
    const yearTwo = curve.find((row) => row.month_key === "2028-07");

    expect(yearOne?.gross_salary).toBe(110000);
    expect(yearOne?.basic_salary).toBe(44000);
    expect(yearTwo?.gross_salary).toBe(121000);
    expect(yearTwo?.basic_salary).toBe(48400);
  });

  it("stops salary at and after retirement month", () => {
    const curve = service.buildMonthlyCurve({
      startMonth: "2026-07",
      endMonth: "2027-03",
      currentGrossSalary: 100000,
      currentBasicSalary: 40000,
      annualIncrementPercent: 8,
      incrementMonth: 7,
      retirementMonth: "2027-01",
      source: "FIXED_LOCKED",
    });

    const dec = curve.find((row) => row.month_key === "2026-12");
    const jan = curve.find((row) => row.month_key === "2027-01");
    const mar = curve.find((row) => row.month_key === "2027-03");

    expect(dec?.is_salary_active).toBe(true);
    expect(dec?.gross_salary).toBeGreaterThan(0);

    expect(jan?.is_salary_active).toBe(false);
    expect(jan?.gross_salary).toBe(0);
    expect(jan?.basic_salary).toBe(0);

    expect(mar?.is_salary_active).toBe(false);
    expect(mar?.gross_salary).toBe(0);
    expect(mar?.basic_salary).toBe(0);
  });

  it("supports shared basic salary curve consumption for EPF and NPS", () => {
    const curve = service.buildMonthlyCurve({
      startMonth: "2026-07",
      endMonth: "2026-09",
      currentGrossSalary: 100000,
      currentBasicSalary: 40000,
      annualIncrementPercent: 0,
      incrementMonth: 7,
      retirementMonth: null,
      source: "FIXED_LOCKED",
    });

    const epfRate = 0.12;
    const npsRate = 0.1;

    const epfByMonth = curve.map((row) => ({ month: row.month_key, contribution: Number((row.basic_salary * epfRate).toFixed(2)) }));
    const npsByMonth = curve.map((row) => ({ month: row.month_key, contribution: Number((row.basic_salary * npsRate).toFixed(2)) }));

    for (let i = 0; i < curve.length; i += 1) {
      expect(epfByMonth[i].month).toBe(curve[i].month_key);
      expect(npsByMonth[i].month).toBe(curve[i].month_key);
      expect(epfByMonth[i].contribution).toBe(4800);
      expect(npsByMonth[i].contribution).toBe(4000);
    }
  });

  it("rejects invalid increment values explicitly", () => {
    expect(() => service.buildMonthlyCurve({
      startMonth: "2026-07",
      endMonth: "2026-09",
      currentGrossSalary: 100000,
      currentBasicSalary: 40000,
      annualIncrementPercent: -1,
      incrementMonth: 7,
      retirementMonth: null,
      source: "FIXED_LOCKED",
    })).toThrow("annualIncrementPercent must be a non-negative finite number.");
  });

  it("preserves fixed and rolling sources in output", () => {
    const fixed = service.buildMonthlyCurve({
      startMonth: "2026-07",
      endMonth: "2026-07",
      currentGrossSalary: 100000,
      currentBasicSalary: 40000,
      annualIncrementPercent: 0,
      incrementMonth: 7,
      retirementMonth: null,
      source: "FIXED_LOCKED",
    });

    const rolling = service.buildMonthlyCurve({
      startMonth: "2026-07",
      endMonth: "2026-07",
      currentGrossSalary: 100000,
      currentBasicSalary: 40000,
      annualIncrementPercent: 0,
      incrementMonth: 7,
      retirementMonth: null,
      source: "ROLLING_REBASE",
    });

    expect(fixed[0]?.source).toBe("FIXED_LOCKED");
    expect(rolling[0]?.source).toBe("ROLLING_REBASE");
  });
});
