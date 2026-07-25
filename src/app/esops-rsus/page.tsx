import { AppLayout } from "@/components/layout/AppLayout";
import { ContentCard } from "@/components/layout/ContentCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export default function EsopsRsusPage() {
  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="ESOPs / RSUs"
          description="Track vesting schedules, grant performance, and equity compensation exposure."
        />
        <ContentCard>
          <EmptyState
            title="ESOPs / RSUs workspace coming soon"
            description="This module will capture grants, vesting timelines, and exercised units while staying aligned with the financial entity model."
          />
        </ContentCard>
      </PageContainer>
    </AppLayout>
  );
}
