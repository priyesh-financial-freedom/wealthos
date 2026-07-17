import { AppLayout } from "@/components/layout/AppLayout";
import { ContentCard } from "@/components/layout/ContentCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export default function ExpensesPage() {
  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="Expenses" description="Understand spending categories, trends, and opportunities to optimize cash flow." />
        <ContentCard>
          <EmptyState title="Expense insights coming soon" description="This section will organize bills, discretionary spend, and budget pacing in one view." />
        </ContentCard>
      </PageContainer>
    </AppLayout>
  );
}
