import type { ProjectionContext, ProjectionContextSerialized } from "./Types";

export class ProjectionContextMapper {
  toSerializable(context: ProjectionContext): ProjectionContextSerialized {
    return {
      runId: context.runId,
      planningInputs: JSON.parse(JSON.stringify(context.planningInputs)),
      openingBalanceSnapshot: JSON.parse(JSON.stringify(context.openingBalanceSnapshot)),
      assumptions: JSON.parse(JSON.stringify(context.assumptions)),
      projectionStartDate: context.projectionStartDate,
      projectionEndDate: context.projectionEndDate,
      scenario: JSON.parse(JSON.stringify(context.scenario)),
      monthlyLedger: context.monthlyLedger.map((record) => ({ ...record })),
      events: context.events.map((event) => ({ ...event })),
      goalSchedule: context.goalSchedule.map((item) => ({ ...item })),
      retirementSchedule: context.retirementSchedule.map((item) => ({ ...item })),
      taxSchedule: context.taxSchedule.map((item) => ({ ...item })),
      cashFlowSchedule: context.cashFlowSchedule.map((item) => ({ ...item })),
    };
  }

  fromSerializable(value: ProjectionContextSerialized): ProjectionContext {
    return {
      runId: value.runId,
      planningInputs: JSON.parse(JSON.stringify(value.planningInputs)),
      openingBalanceSnapshot: JSON.parse(JSON.stringify(value.openingBalanceSnapshot)),
      assumptions: JSON.parse(JSON.stringify(value.assumptions)),
      projectionStartDate: value.projectionStartDate,
      projectionEndDate: value.projectionEndDate,
      scenario: JSON.parse(JSON.stringify(value.scenario)),
      monthlyLedger: value.monthlyLedger.map((record) => ({ ...record })),
      events: value.events.map((event) => ({ ...event })),
      goalSchedule: value.goalSchedule.map((item) => ({ ...item })),
      retirementSchedule: value.retirementSchedule.map((item) => ({ ...item })),
      taxSchedule: value.taxSchedule.map((item) => ({ ...item })),
      cashFlowSchedule: value.cashFlowSchedule.map((item) => ({ ...item })),
    };
  }
}
