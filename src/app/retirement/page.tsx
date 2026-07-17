import { AppLayout } from "@/components/layout/AppLayout";
import { ContentCard } from "@/components/layout/ContentCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export default function RetirementPage() {
  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="Retirement" description="Plan ahead with clarity around retirement timing, contributions, and long-term outlook." />
        <ContentCard>
          <EmptyState title="Retirement planning coming soon" description="This section will organize targets, assumptions, and progress toward your future self." />
        </ContentCard>
      </PageContainer>
    </AppLayout>
  );
}
