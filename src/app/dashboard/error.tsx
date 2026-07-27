"use client";

import { useEffect } from "react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AppLayout } from "@/components/layout/AppLayout";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <AppLayout>
      <PageContainer>
        <ContentContainer className="border-none bg-transparent p-0 shadow-none">
          <DashboardCard>
            <h2 className="text-xl font-semibold text-slate-900">Executive Dashboard Error</h2>
            <p className="mt-2 text-sm text-slate-600">Unable to render the dashboard right now.</p>
            <p className="mt-1 text-xs text-slate-500">{error.message}</p>
            <Button className="mt-5" onClick={() => unstable_retry()}>
              Retry
            </Button>
          </DashboardCard>
        </ContentContainer>
      </PageContainer>
    </AppLayout>
  );
}
