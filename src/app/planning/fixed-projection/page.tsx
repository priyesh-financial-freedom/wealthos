import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { FixedProjectionWorkflow } from "./FixedProjectionWorkflow";
import { createPlanningAssumptionServerService } from "@/services/planning/assumptions/server";
import { createProjectionReadServerService } from "@/services/projection/ProjectionReadService";

export default async function FixedProjectionPage() {
  const service = createProjectionReadServerService();
  const assumptionsService = createPlanningAssumptionServerService();
  const [projectionResult, familyProfileResult, assumptionsResult] = await Promise.allSettled([
    service.getLatestLockedFixedProjection(),
    assumptionsService.getFamilyProfile(),
    assumptionsService.getEffectiveAssumptions(),
  ]);

  const projection = projectionResult.status === "fulfilled" ? projectionResult.value : null;
  const familyProfile = familyProfileResult.status === "fulfilled" ? familyProfileResult.value : null;
  const effectiveAssumptions = assumptionsResult.status === "fulfilled" ? assumptionsResult.value : null;

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Fixed Projection"
          description="Review the month-wise fixed projection output for key financial buckets."
          summary="Original locked plan from July 2026"
        />

        <FixedProjectionWorkflow
          lockedProjection={projection}
          primaryCurrentAge={familyProfile?.primaryCurrentAge ?? null}
          retirementAge={effectiveAssumptions?.retirementAge ?? null}
          debtAnnualReturnPercent={effectiveAssumptions?.debtReturn ?? null}
        />
      </PageContainer>
    </AppLayout>
  );
}
