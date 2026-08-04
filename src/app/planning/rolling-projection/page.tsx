import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { createProjectionReadServerService } from "@/services/projection/ProjectionReadService";
import { RollingProjectionWorkflow } from "./RollingProjectionWorkflow";

export default async function RollingProjectionPage() {
  const service = createProjectionReadServerService();
  const projection = await service.getLatestLockedRollingProjection().catch(() => null);

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Rolling Projection"
          description="Preview and freeze rolling projections from latest month-end actuals."
          summary="Rolling forecast linked to latest locked Fixed Projection"
        />
        <RollingProjectionWorkflow
          lockedProjection={projection}
          primaryCurrentAge={null}
          retirementAge={null}
        />
      </PageContainer>
    </AppLayout>
  );
}
