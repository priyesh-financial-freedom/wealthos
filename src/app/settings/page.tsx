import { AppLayout } from "@/components/layout/AppLayout";
import { ContentCard } from "@/components/layout/ContentCard";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function SettingsPage() {
  const sections = [
    {
      title: "Profile",
      description: "Personal details, date of birth, retirement date, and life expectancy.",
      href: "/settings/my-profile",
      cta: "Open Profile",
    },
    {
      title: "Family",
      description: "Manage family details, members, and planning context.",
      href: "/settings/family",
      cta: "Open Family",
    },
    {
      title: "Assumptions",
      description: "Inflation, salary growth, and return assumptions used across projections.",
      href: "/settings/planning-assumptions",
      cta: "Open Assumptions",
    },
    {
      title: "Targets",
      description: "Retirement corpus, savings rate, emergency fund, and asset allocation targets.",
      href: "/settings/financial-preferences",
      cta: "Open Targets",
    },
  ];

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="Settings" description="Manage profile, family, assumptions, and targets from one place." />
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <ContentCard key={section.href}>
              <div className="flex h-full flex-col gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
                  <p className="text-sm text-slate-600">{section.description}</p>
                </div>
                <div className="mt-auto">
                  <Button asChild variant="outline">
                    <Link href={section.href}>{section.cta}</Link>
                  </Button>
                </div>
              </div>
            </ContentCard>
          ))}
          <div className="md:col-span-2">
            <ContentCard>
              <p className="text-sm text-slate-600">These pages preserve current routes while simplifying personal-family configuration.</p>
            </ContentCard>
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
