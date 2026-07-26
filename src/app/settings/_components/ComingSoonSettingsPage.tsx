import { AppLayout } from "@/components/layout/AppLayout";
import { ContentCard } from "@/components/layout/ContentCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageBreadcrumb } from "@/components/layout/PageBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

interface ComingSoonSettingsPageProps {
  title: string;
  description: string;
}

export function ComingSoonSettingsPage({ title, description }: ComingSoonSettingsPageProps) {
  return (
    <AppLayout>
      <PageContainer>
        <PageBreadcrumb items={[{ label: "Settings", href: "/settings" }, { label: title }]} />
        <PageHeader title={title} description={description} />
        <ContentCard>
          <EmptyState title="Coming Soon" description="This settings section is planned and will be available in an upcoming sprint." />
        </ContentCard>
      </PageContainer>
    </AppLayout>
  );
}
