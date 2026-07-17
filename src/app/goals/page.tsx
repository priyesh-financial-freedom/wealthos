import { AppLayout } from "@/components/layout/AppLayout";
import { ContentCard } from "@/components/layout/ContentCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export default function GoalsPage() {
  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="Goals" description="Shape priorities and track progress toward meaningful financial milestones." />
        <ContentCard>
          <EmptyState title="Goal planning coming soon" description="This page will connect your plans, timelines, and target balances into a single roadmap." />
        </ContentCard>
      </PageContainer>
    </AppLayout>
  );
}
