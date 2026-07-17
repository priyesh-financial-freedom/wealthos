import { AppLayout } from "@/components/layout/AppLayout";
import { ContentCard } from "@/components/layout/ContentCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export default function AIPage() {
  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="AI Advisor" description="Bring intelligent suggestions and future-facing guidance into the wealth management experience." />
        <ContentCard>
          <EmptyState title="AI advisor experience coming soon" description="This page will host personalized recommendations, prompts, and next-best actions." />
        </ContentCard>
      </PageContainer>
    </AppLayout>
  );
}
