import { AppLayout } from "@/components/layout/AppLayout";
import { ContentCard } from "@/components/layout/ContentCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export default function ReportsPage() {
  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="Reports" description="Generate clean summaries for planning, visibility, and strategic conversations." />
        <ContentCard>
          <EmptyState title="Reports hub coming soon" description="This area will deliver export-ready snapshots and recurring reporting views." />
        </ContentCard>
      </PageContainer>
    </AppLayout>
  );
}
