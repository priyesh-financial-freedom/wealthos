import { AppLayout } from "@/components/layout/AppLayout";
import { ContentCard } from "@/components/layout/ContentCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export default function InvestmentsPage() {
  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="Investments" description="Review holdings, growth trends, and diversification across your portfolio." />
        <ContentCard>
          <EmptyState title="Investment insights coming soon" description="This section will surface allocations, performance, and rebalancing opportunities." />
        </ContentCard>
      </PageContainer>
    </AppLayout>
  );
}
