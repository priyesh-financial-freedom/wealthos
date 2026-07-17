import { AppLayout } from "@/components/layout/AppLayout";
import { ContentCard } from "@/components/layout/ContentCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export default function InsurancePage() {
  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="Insurance" description="Keep coverage, beneficiaries, and protection plans organized in one place." />
        <ContentCard>
          <EmptyState title="Insurance overview coming soon" description="This section will present policies, beneficiaries, and annual premiums with transparency." />
        </ContentCard>
      </PageContainer>
    </AppLayout>
  );
}
