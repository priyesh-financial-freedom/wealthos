"use client";

import { useEffect, useState } from "react";

import { ExecutiveDashboard } from "@/components/dashboard/ExecutiveDashboard";
import { AppLayout } from "@/components/layout/AppLayout";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { PageBreadcrumb } from "@/components/layout/PageBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import { executiveDashboardService, type ExecutiveDashboardData } from "@/services/dashboard";

export default function DashboardPage() {
  const [data, setData] = useState<ExecutiveDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      try {
        const response = await executiveDashboardService.getDashboard();
        if (!isMounted) {
          return;
        }

        setData(response);
        setError(null);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to refresh dashboard");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    const handleRefresh = () => {
      void loadDashboard();
    };

    void loadDashboard();

    window.addEventListener("focus", handleRefresh);
    window.addEventListener("wealthos:finance-data-updated", handleRefresh);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener("wealthos:finance-data-updated", handleRefresh);
    };
  }, []);

  return (
    <AppLayout>
      <PageContainer className="mx-auto w-full max-w-[1220px]">
        <PageBreadcrumb items={[{ label: "WealthOS", href: "/dashboard" }, { label: "Executive Dashboard" }]} />

        <ContentContainer className="border-none bg-transparent p-0 shadow-none">
          <ExecutiveDashboard loading={loading} data={data} error={error} />
        </ContentContainer>
      </PageContainer>
    </AppLayout>
  );
}
