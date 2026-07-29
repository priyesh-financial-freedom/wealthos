import type { MonthEndCloseEntityType, MonthEndCloseItemKey, MonthEndCloseItemType, MonthEndCloseStatus } from "./monthEndClose";

export enum FinancialPeriodStatus {
  OPEN = "open",
  CLOSED = "closed",
}

export enum FinancialPeriodDomainErrorCode {
  PERIOD_NOT_FOUND = "PERIOD_NOT_FOUND",
  INVALID_TRANSITION = "INVALID_TRANSITION",
  REOPEN_REASON_REQUIRED = "REOPEN_REASON_REQUIRED",
  REOPEN_NOT_LATEST_CLOSED = "REOPEN_NOT_LATEST_CLOSED",
}

export enum MonthEndCloseBalanceDomainErrorCode {
  REQUIRED_ACTUAL_BALANCE_MISSING = "REQUIRED_ACTUAL_BALANCE_MISSING",
  NEGATIVE_ACTUAL_BALANCE = "NEGATIVE_ACTUAL_BALANCE",
}

export interface FinancialPeriodTransitionRequest {
  userId: string;
  closeId: string;
  toStatus: FinancialPeriodStatus;
  reason?: string | null;
}

export interface FinancialPeriodTransitionAuditEntry {
  id: string;
  closeId: string;
  userId: string;
  fromStatus: FinancialPeriodStatus;
  toStatus: FinancialPeriodStatus;
  reason: string | null;
  transitionedAt: string;
  createdAt: string;
}

export interface FinancialPeriodDomainErrorDetails {
  code: FinancialPeriodDomainErrorCode;
  message: string;
}

export class FinancialPeriodDomainError extends Error {
  readonly code: FinancialPeriodDomainErrorCode;

  constructor(details: FinancialPeriodDomainErrorDetails) {
    super(details.message);
    this.code = details.code;
    this.name = "FinancialPeriodDomainError";
  }
}

export interface MonthEndCloseBalanceDomainErrorDetails {
  code: MonthEndCloseBalanceDomainErrorCode;
  message: string;
}

export class MonthEndCloseBalanceDomainError extends Error {
  readonly code: MonthEndCloseBalanceDomainErrorCode;

  constructor(details: MonthEndCloseBalanceDomainErrorDetails) {
    super(details.message);
    this.code = details.code;
    this.name = "MonthEndCloseBalanceDomainError";
  }
}

export interface MonthEndCloseAggregate {
  id: string;
  userId: string;
  closeMonth: number;
  closeYear: number;
  versionNumber: number;
  status: MonthEndCloseStatus;
  supersedesCloseId: string | null;
  closedAt: string | null;
  reopenReason: string | null;
  reopenedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonthEndCloseLineItem {
  id: string;
  closeId: string;
  userId: string;
  entityId: string;
  entityType: MonthEndCloseEntityType | string;
  entityName: string;
  itemKey: MonthEndCloseItemKey;
  itemLabel: string;
  itemType: MonthEndCloseItemType;
  sortOrder: number;
  openingValue: number;
  projectedValue: number;
  actualValue: number;
  actualBalance: number | null;
  isRequired: boolean;
  absoluteVariance: number;
  percentageVariance: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonthEndCloseLineItemInput {
  entityId: string;
  entityType: MonthEndCloseEntityType | string;
  entityName: string;
  itemKey: MonthEndCloseItemKey;
  itemLabel: string;
  itemType: MonthEndCloseItemType;
  sortOrder: number;
  openingValue?: number;
  projectedValue?: number;
  actualValue?: number;
  actualBalance?: number | null;
  isRequired?: boolean;
}

export interface MonthEndCloseDraftUpsertInput {
  userId: string;
  closeMonth: number;
  closeYear: number;
  items: MonthEndCloseLineItemInput[];
  closeId?: string | null;
}
