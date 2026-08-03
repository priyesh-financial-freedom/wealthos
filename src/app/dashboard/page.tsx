"use client";

import { useEffect, useRef, useState } from "react";

import { ExecutiveDashboard } from "@/components/dashboard/ExecutiveDashboard";
import { AppLayout } from "@/components/layout/AppLayout";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { PageBreadcrumb } from "@/components/layout/PageBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import type { ExecutiveDashboardData } from "@/components/dashboard/dashboardTypes";
import { mergeOptionalDashboardData } from "./dashboardState";

export default function DashboardPage() {
  const [data, setData] = useState<ExecutiveDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [optionalLoading, setOptionalLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadSequenceRef = useRef(0);

  useEffect(() => {
    let isMounted = true;

    async function loadOptionalDashboard(loadSequence: number) {
      try {
        const optionalResponse = await fetch("/api/dashboard/optional");
        if (!optionalResponse.ok) {
          throw new Error("Unable to load dashboard optional widgets");
        }

        const optionalData = (await optionalResponse.json()) as Partial<ExecutiveDashboardData>;
        if (!isMounted || loadSequence !== loadSequenceRef.current) {
          return;
        }

        setData((current) => mergeOptionalDashboardData(current, optionalData));
      } catch {
        return;
      } finally {
        if (isMounted && loadSequence === loadSequenceRef.current) {
          setOptionalLoading(false);
        }
      }
    }

    async function loadDashboard() {
      const loadSequence = ++loadSequenceRef.current;

      try {
        setLoading(true);
        setOptionalLoading(true);

        const coreResponse = await fetch("/api/dashboard/core");
        if (!coreResponse.ok) {
          throw new Error("Unable to load dashboard core");
        }

        const coreData = (await coreResponse.json()) as ExecutiveDashboardData;
        if (!isMounted || loadSequence !== loadSequenceRef.current) {
          return;
        }

        setData(coreData);
        setError(null);
        setLoading(false);

        void loadOptionalDashboard(loadSequence);
      } catch (loadError) {
        if (!isMounted || loadSequence !== loadSequenceRef.current) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to refresh dashboard");
        setLoading(false);
        setOptionalLoading(false);
      } finally {
        if (isMounted && loadSequence === loadSequenceRef.current) {
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
          <ExecutiveDashboard loading={loading} optionalLoading={optionalLoading} data={data} error={error} />
        </ContentContainer>
      </PageContainer>
    </AppLayout>
  );
}
