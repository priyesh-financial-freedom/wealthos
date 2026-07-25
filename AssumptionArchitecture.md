# AssumptionArchitecture

## Executive Verdict
WealthOS currently has two assumption models, but they do not have equal authority.

- The authoritative editable model is the Planning Assumption Registry and its derived `EffectivePlanningAssumptions`.
- The Runtime Assumptions Bundle is a legacy compatibility shape used to feed older consumers and to keep the Projection Engine working during the transition.

That means the architecture is not a clean dual-source design. It is a migration in progress that has been partially completed:
- intentional separation at the design level,
- unfinished mapping at the implementation level,
- and some obsolete legacy fields that no longer participate in runtime projection math.

## Source of Truth Hierarchy
1. Planning assumptions are defined in the registry and persisted through the planning assumptions service.
2. The planning service resolves those values into `EffectivePlanningAssumptions`.
3. The legacy runtime bundle is produced by mapping only a subset of those effective values.
4. Projection Engine still consumes the legacy bundle through `assumptionsService.getAssumptionsBundle(...)`.

Evidence:
- [docs/PROJECT_ARCHITECTURE.md](docs/PROJECT_ARCHITECTURE.md#L33) says the Assumptions Engine stores editable planning assumptions and feeds the Projection Engine.
- [src/services/planning/assumptions/AssumptionService.ts](src/services/planning/assumptions/AssumptionService.ts#L527) returns `editorState.effective.values` from `getEffectiveAssumptions(...)`.
- [src/services/planning/assumptions/AssumptionService.ts](src/services/planning/assumptions/AssumptionService.ts#L299) maps effective planning assumptions into the legacy bundle.
- [src/services/planning/assumptions/AssumptionService.ts](src/services/planning/assumptions/AssumptionService.ts#L540) exposes `getLegacyAssumptionsBundle(...)`.
- [src/services/assumptions.ts](src/services/assumptions.ts#L55) exposes `getAssumptionsBundle(...)` as a retired compatibility wrapper.
- [src/services/projection/ProjectionInputService.ts](src/services/projection/ProjectionInputService.ts#L440) still consumes that bundle inside the runtime projection context builder.

## Which Model Is Authoritative?
The Planning Assumption Registry is the authoritative source of editable planning truth.

Why:
- It is the model that stores the full assumption catalog.
- It carries the field metadata, categories, defaults, recommendations, and provenance.
- It is the source from which `EffectivePlanningAssumptions` are computed.
- The runtime bundle is not a primary store; it is a projection-friendly translation layer.

The runtime bundle is authoritative only for the narrow legacy contract it exposes, not for the full assumption domain.

## Why Many Planning Assumptions Are Never Mapped Into the Runtime Bundle
This happens for three different reasons.

### 1. The runtime bundle is intentionally narrower than the planning registry
The bundle shape in [src/types/assumptions.ts](src/types/assumptions.ts#L1) only contains a small set of broad categories:
- income
- investments
- inflation
- loans
- retirement
- tax
- planning

By contrast, the planning registry contains many more explicit fields such as `bonusGrowthRate`, `cashReturn`, `npsEquityReturn`, `dividendTax`, and `goalFundingPriority` in [src/services/planning/assumptions/AssumptionTypes.ts](src/services/planning/assumptions/AssumptionTypes.ts#L20) and [src/services/planning/assumptions/AssumptionRegistry.ts](src/services/planning/assumptions/AssumptionRegistry.ts#L16).

### 2. The legacy mapper only maps values that the old runtime contract expects
`mapLegacyBundle(...)` in [src/services/planning/assumptions/AssumptionService.ts](src/services/planning/assumptions/AssumptionService.ts#L299) only translates a subset of the effective assumptions into the legacy bundle fields. Anything without a matching field in the legacy bundle is simply dropped.

That is not accidental. It is a compatibility adapter.

### 3. The current Projection Engine only executes a subset of the available model
Even when a value exists in the bundle, Projection Engine may not use it. The runtime pipeline in [src/services/projection/ProjectionEngine.ts](src/services/projection/ProjectionEngine.ts#L235) only runs step classes, and the step logic consumes a limited set of bundle fields.

So unmapped assumptions fall into one of these buckets:
- no runtime rule exists yet,
- the assumption is planning-only,
- the assumption is an obsolete duplicate of another field,
- or the runtime still expects a legacy alias rather than the newer planning field.

## Is This an Unfinished Migration, Intentional Separation, or Obsolete Design?
The correct answer is: all three, but in different parts of the system.

### Intentional separation
The architectural separation is intentional. The docs explicitly say the assumptions layer should be separate from the record engine and projection engine.
- [docs/PROJECT_ARCHITECTURE.md](docs/PROJECT_ARCHITECTURE.md#L33) and [docs/PROJECT_ARCHITECTURE.md](docs/PROJECT_ARCHITECTURE.md#L65) describe this as a service boundary.

### Unfinished migration
The implementation is still mid-migration because Projection Engine has not been fully rewritten to consume the richer planning model directly.
- The old runtime API is still present in [src/services/assumptions.ts](src/services/assumptions.ts#L25).
- The Projection Engine still asks for the legacy bundle in [src/services/projection/ProjectionInputService.ts](src/services/projection/ProjectionInputService.ts#L440).
- Many planning assumptions exist in the registry but have no runtime consumer.

### Obsolete design
Some fields are effectively obsolete, not just unmapped.
Examples:
- duplicate retirement salary-stop fields in the legacy bundle,
- legacy aliases such as `income.annualIncrementRate`,
- and runtime exports that survive only for compatibility.

Those are signs that the old contract is still being carried forward after the newer planning model replaced it.

## Architectural Read
The most accurate reading is:
- planning assumptions are the canonical domain model,
- the runtime bundle is a legacy compatibility surface,
- and the current state is a partially completed migration away from the old bundle-centric runtime.

This is not a pure accidental orphaning story. It looks deliberate at the boundary level, but incomplete inside the runtime implementation.

## Practical Consequence
If a planning assumption is not mapped into the runtime bundle, it does not necessarily mean the assumption is wrong. It usually means one of two things:
- the runtime has no rule for it yet,
- or the assumption model has outgrown the legacy bundle contract.

That is why a large number of planning assumptions are visible in the registry but absent from monthly projection math.

## Recommended Interpretation for Sprint Planning
Treat the planning registry as the source of truth and the legacy runtime bundle as technical debt.

The right follow-up work is not to reintroduce bundle-centric modeling. It is to decide which planning assumptions should be promoted into the runtime engine and which should remain planning-only.
