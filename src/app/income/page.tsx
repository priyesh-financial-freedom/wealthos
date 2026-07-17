import { AppLayout } from "@/components/layout/AppLayout";
import { ContentCard } from "@/components/layout/ContentCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export default function IncomePage() {
  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="Income" description="Monitor recurring income, salary, and flexible revenue streams with clarity." />
        <ContentCard>
          <EmptyState title="Income tracking coming soon" description="This page will capture streams, timing, and expected cash flow for the month ahead." />
        </ContentCard>
      </PageContainer>
    </AppLayout>
  );
}
