import { AppLayout } from "@/components/layout/AppLayout";
import { ContentCard } from "@/components/layout/ContentCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export default function SettingsPage() {
  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="Settings" description="Control preferences, integrations, and account configuration from a central place." />
        <ContentCard>
          <EmptyState title="Settings panel coming soon" description="This area will provide account preferences, notifications, and security controls." />
        </ContentCard>
      </PageContainer>
    </AppLayout>
  );
}
