# Investment Projection Architecture

## Goal
Introduce per-asset month-to-month projection state with the smallest possible architectural change, while preserving:
- ProjectionEngine control flow
- ProjectionPipeline step model
- Monthly Ledger shape
- Snapshot architecture
- Backward compatibility for existing aggregated consumers

## Why This Is Needed
Current state is aggregated at month level:
- Projection month state is totals only in [src/services/projection/ProjectionContext.ts](src/services/projection/ProjectionContext.ts#L38).
- Opening balances are flattened in [src/services/projection/ProjectionInputService.ts](src/services/projection/ProjectionInputService.ts#L221) and [src/services/projection/ProjectionInputService.ts](src/services/projection/ProjectionInputService.ts#L260).
- Rolling state resets to aggregate fields in [src/services/projection/ProjectionEngine.ts](src/services/projection/ProjectionEngine.ts#L302).

Result: asset-specific buckets such as gold, EPF, PPF, and NPS do not carry projected opening-to-closing balances across months.

## Smallest Architectural Change

### 1) Add optional detailed projection state alongside existing totals
Extend ProjectionMonthState with an optional detail container, keeping existing top-level totals unchanged for compatibility.

Proposed shape (conceptual):
- cash, investments, assets, liabilities, retirementCorpus (existing)
- details (new optional)
- details.investmentBuckets:
  - mutualFunds
  - stocks
  - fixedDeposits
  - gold
  - silver
  - otherInvestments
- details.retirementBuckets:
  - epf
  - ppf
  - nps

Why this is minimal:
- Existing steps can continue reading top-level totals.
- New logic can use details when present.
- No new assumption model is introduced.

Insertion point: [src/services/projection/ProjectionContext.ts](src/services/projection/ProjectionContext.ts#L38)

### 2) Keep totals as the contract; derive them from bucket details
Add helper functions in ProjectionContext to compute totals from details:
- investments equals sum of investmentBuckets
- retirementCorpus equals sum of retirementBuckets
- net effects continue to flow into existing MonthlyLedgerRecord fields

This preserves all existing interfaces that depend on aggregate totals, including:
- ledger record fields in [src/types/projection.ts](src/types/projection.ts#L272)
- snapshot balance state generated in [src/services/projection/ProjectionEngine.ts](src/services/projection/ProjectionEngine.ts#L78)

### 3) Seed opening detailed buckets in ProjectionInputService
When building opening state:
- populate details.investmentBuckets and details.retirementBuckets from live data and month-end close inputs
- also compute aggregate totals exactly as today

Insertion points:
- [src/services/projection/ProjectionInputService.ts](src/services/projection/ProjectionInputService.ts#L221)
- [src/services/projection/ProjectionInputService.ts](src/services/projection/ProjectionInputService.ts#L260)
- [src/services/projection/ProjectionInputService.ts](src/services/projection/ProjectionInputService.ts#L263)

### 4) Preserve ProjectionEngine loop; change only rolling state source
Today rolling state is rebuilt from finalized aggregate ledger values in [src/services/projection/ProjectionEngine.ts](src/services/projection/ProjectionEngine.ts#L302).

Minimal change:
- set rollingState from executedContext.currentState (already produced by steps), not only from finalizedRecord aggregates.

Why this matters:
- details bucket state can roll forward month-to-month without changing the pipeline orchestration.
- engine timeline generation, step execution order, ledger append, and snapshot construction remain intact.

Relevant loop anchors:
- [src/services/projection/ProjectionEngine.ts](src/services/projection/ProjectionEngine.ts#L286)
- [src/services/projection/ProjectionEngine.ts](src/services/projection/ProjectionEngine.ts#L295)
- [src/services/projection/ProjectionEngine.ts](src/services/projection/ProjectionEngine.ts#L302)

### 5) Update only InvestmentStep to become bucket-aware
InvestmentStep should:
- read opening bucket balances from currentState.details when available
- compute per-bucket growth and contributions
- write updated bucket balances back to currentState.details
- recompute aggregate cash, investments, and retirementCorpus from bucket details

No pipeline rewrite required because InvestmentStep already owns investment and retirement growth logic at [src/services/projection/steps/InvestmentStep.ts](src/services/projection/steps/InvestmentStep.ts#L16).

### 6) Keep Monthly Ledger and Snapshot formats stable
Do not break current output contracts:
- keep aggregate ledger fields unchanged
- keep aggregate snapshot balances unchanged
- continue creating projectedEntities as now in [src/services/projection/ProjectionEngine.ts](src/services/projection/ProjectionEngine.ts#L100)

Optional non-breaking enhancement:
- append additional projectedEntities for bucket-level lines (gold, stocks, EPF, PPF, NPS) while retaining existing aggregate entities.

## Migration Strategy

### Phase A: State Scaffolding (No behavior change)
- Add optional details structure to ProjectionMonthState.
- Add helper functions to normalize and aggregate details.
- If details are absent, behavior remains exactly current.

### Phase B: Opening State Seeding
- Populate details for live and month-end-close starts.
- Validate aggregate totals equal current totals.

### Phase C: InvestmentStep Bucket Roll-Forward
- Move gold, cash-return, and retirement sleeve math to bucket-level updates.
- Recompute aggregate fields from details at end of step.
- Keep ledger math and record patch fields unchanged.

### Phase D: Engine Roll-Forward Preservation
- Switch rollingState source to executedContext.currentState so details persist month-to-month.
- No change to timeline, pipeline, or snapshot assembler signatures.

### Phase E: Optional Snapshot Enrichment
- Add bucket-level projectedEntities entries while keeping existing aggregate entries.
- Viewer can opt into detailed rows without breaking current cards/charts.

## Backward Compatibility
- Existing consumers of:
  - currentState.investments
  - currentState.retirementCorpus
  - MonthlyLedgerRecord
  - MonthlySnapshot.openingBalances and closingBalances
  remain valid.
- Legacy compatibility adapter for assumptions remains untouched.

## Invariants To Enforce During Migration
For every month:
1. Sum of investmentBuckets equals investments total.
2. Sum of retirementBuckets equals retirementCorpus total.
3. Opening plus contributions plus growth plus other equals closing for each bucket.
4. Aggregate ledger totals equal sums derived from bucket-level deltas.

## Test Plan
1. ProjectionInputService tests:
- opening details seeded for live and close starts.
- details sums equal aggregate totals.

2. InvestmentStep tests:
- per-bucket growth applied once.
- no double counting between gold and non-gold buckets.
- retirement bucket growth and contributions reconcile to aggregate retirementCorpus.

3. ProjectionEngine integration tests:
- bucket balances roll forward month-to-month.
- aggregate snapshots and ledger remain unchanged in shape.
- projectedEntities includes stable aggregate rows and optional detailed rows.

## Risk and Mitigation

Risk: hidden drift between detail buckets and aggregate fields.
Mitigation: single aggregation helper as the only write path for aggregate totals.

Risk: breaking downstream viewer assumptions.
Mitigation: keep existing aggregate snapshot fields and projectedEntities rows unchanged; add detail rows only as additive output.

Risk: migration complexity across steps.
Mitigation: confine bucket logic to ProjectionContext helpers, ProjectionInputService seeding, InvestmentStep updates, and one rollingState assignment in ProjectionEngine.

## Recommended Sprint Sequence For This Change
1. Add ProjectionMonthState.details and aggregation helpers.
2. Seed opening details in ProjectionInputService.
3. Update InvestmentStep to read and write details.
4. Preserve details in ProjectionEngine rollingState.
5. Add tests and then optional snapshot entity enrichment.

This is the smallest architecture that enables true per-asset roll-forward without rewriting ProjectionEngine or replacing the existing pipeline and snapshot/ledger contracts.
