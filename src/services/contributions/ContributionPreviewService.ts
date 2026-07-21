import type { ContributionPolicy, ContributionPreview } from "@/types/contributionPolicy";

export interface ContributionPreviewInput {
  horizonMonths?: number;
  fromDate?: string;
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function getFrequencyMonths(frequency: ContributionPolicy["frequency"]) {
  if (frequency === "MONTHLY") {
    return 1;
  }

  if (frequency === "QUARTERLY") {
    return 3;
  }

  return 12;
}

function fullYearsBetween(start: Date, current: Date) {
  const years = current.getFullYear() - start.getFullYear();
  if (years <= 0) {
    return 0;
  }

  const hasReachedAnniversary =
    current.getMonth() > start.getMonth() || (current.getMonth() === start.getMonth() && current.getDate() >= start.getDate());

  return hasReachedAnniversary ? years : years - 1;
}

function calculateGrowthAmount(policy: ContributionPolicy, baseAmount: number, contributionDate: Date) {
  const yearsElapsed = fullYearsBetween(new Date(policy.startDate), contributionDate);

  if (policy.growthStrategy === "STEP_UP_PERCENTAGE") {
    const rate = Number(policy.growthRate ?? 0) / 100;
    return Number((baseAmount * Math.pow(1 + rate, yearsElapsed) - baseAmount).toFixed(2));
  }

  if (policy.growthStrategy === "STEP_UP_AMOUNT") {
    return Number((Number(policy.growthAmount ?? 0) * yearsElapsed).toFixed(2));
  }

  return 0;
}

export class ContributionPreviewService {
  generate(policy: ContributionPolicy, input: ContributionPreviewInput = {}): ContributionPreview {
    const horizonMonths = Math.max(1, input.horizonMonths ?? 24);
    const frequencyInMonths = getFrequencyMonths(policy.frequency);
    const policyStart = new Date(policy.startDate);
    const previewStart = input.fromDate ? new Date(input.fromDate) : new Date();
    const previewEnd = addMonths(previewStart, horizonMonths);
    const hardEnd = policy.endDate ? new Date(policy.endDate) : null;
    const schedule: ContributionPreview["schedule"] = [];

    let cursor = new Date(policyStart);
    let index = 0;

    while (cursor <= previewEnd) {
      const withinPreviewWindow = cursor >= previewStart;
      const withinPolicyEnd = !hardEnd || cursor <= hardEnd;

      if (withinPreviewWindow && withinPolicyEnd) {
        const baseAmount = Number(policy.amount);
        const growthAmount = calculateGrowthAmount(policy, baseAmount, cursor);
        const totalAmount = Number((baseAmount + growthAmount).toFixed(2));

        schedule.push({
          index: schedule.length + 1,
          contributionDate: toIsoDate(cursor),
          baseAmount,
          growthAmount,
          totalAmount,
        });
      }

      index += 1;
      if (index > 1000) {
        break;
      }

      cursor = addMonths(cursor, frequencyInMonths);

      if (hardEnd && cursor > hardEnd) {
        break;
      }
    }

    const projectedTotal = schedule.reduce((sum, item) => sum + item.totalAmount, 0);

    return {
      policyId: policy.id,
      policyName: policy.name,
      generatedAt: new Date().toISOString(),
      horizonMonths,
      projectedTotal: Number(projectedTotal.toFixed(2)),
      schedule,
    };
  }
}
