import { AppLayout } from "@/components/layout/AppLayout";
import { ContentCard } from "@/components/layout/ContentCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export default function DocumentsPage() {
  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="Documents" description="Keep statements, contracts, and important files available in a secure workspace." />
        <ContentCard>
          <EmptyState title="Document library coming soon" description="This area will centralize uploaded files and key records for reference." />
        </ContentCard>
      </PageContainer>
    </AppLayout>
  );
}
