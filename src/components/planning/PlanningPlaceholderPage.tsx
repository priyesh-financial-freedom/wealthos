import { AppLayout } from "@/components/layout/AppLayout";
import { ContentCard } from "@/components/layout/ContentCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

interface PlanningPlaceholderPageProps {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
}

export function PlanningPlaceholderPage({ title, description, emptyTitle, emptyDescription }: PlanningPlaceholderPageProps) {
  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title={title} description={description} />
        <ContentCard>
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </ContentCard>
      </PageContainer>
    </AppLayout>
  );
}
