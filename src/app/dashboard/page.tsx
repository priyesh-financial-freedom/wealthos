"use client";

import { useEffect, useState } from "react";

import { ExecutiveDashboard } from "@/components/dashboard/ExecutiveDashboard";
import { AppLayout } from "@/components/layout/AppLayout";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { PageBreadcrumb } from "@/components/layout/PageBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { executiveDashboardService, type ExecutiveDashboardData } from "@/services/dashboard";

export default function DashboardPage() {
  const [data, setData] = useState<ExecutiveDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      const startedAt = Date.now();
      console.log("[DashboardPage] loadDashboard start", { startedAt });
      try {
        console.log("[DashboardPage] before executiveDashboardService.getDashboard");
        const response = await executiveDashboardService.getDashboard();
        console.log("[DashboardPage] after executiveDashboardService.getDashboard", {
          durationMs: Date.now() - startedAt,
          hasData: Boolean(response),
          emptyState: response.emptyState,
        });
        if (!isMounted) {
          console.log("[DashboardPage] loadDashboard ignored result because component unmounted");
          return;
        }

        setData(response);
        setError(null);
      } catch (loadError) {
        console.error("[DashboardPage] loadDashboard error", {
          durationMs: Date.now() - startedAt,
          loadError,
        });
        if (!isMounted) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to refresh dashboard");
      } finally {
        if (isMounted) {
          console.log("[DashboardPage] loadDashboard finished", {
            durationMs: Date.now() - startedAt,
          });
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
      <PageContainer>
        <PageBreadcrumb items={[{ label: "WealthOS", href: "/dashboard" }, { label: "Executive Dashboard" }]} />
        <PageHeader
          title="Executive Dashboard"
          description="A true executive command center with health, goals, decisions, and projected cash flow in one place."
        />

        <ContentContainer className="border-none bg-transparent p-0 shadow-none">
          <ExecutiveDashboard loading={loading} data={data} error={error} />
        </ContentContainer>
      </PageContainer>
    </AppLayout>
  );
}
