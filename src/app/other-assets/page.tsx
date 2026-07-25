import { AppLayout } from "@/components/layout/AppLayout";
import { ContentCard } from "@/components/layout/ContentCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export default function OtherAssetsPage() {
  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Other Assets"
          description="Manage non-core assets and long-tail holdings that do not fit standard investment or property modules."
        />
        <ContentCard>
          <EmptyState
            title="Other assets workspace coming soon"
            description="This page will be expanded to support cataloging and valuation flows for other asset entities."
          />
        </ContentCard>
      </PageContainer>
    </AppLayout>
  );
}
