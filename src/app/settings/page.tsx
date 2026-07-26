import { AppLayout } from "@/components/layout/AppLayout";
import { ContentCard } from "@/components/layout/ContentCard";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function SettingsPage() {
  const sections = [
    {
      title: "My Profile",
      description: "Personal details, login profile, and account-level information.",
      href: "/settings/my-profile",
      cta: "Open My Profile",
    },
    {
      title: "Family",
      description: "Manage family details, members, and planning context.",
      href: "/settings/family",
      cta: "Open Family",
    },
    {
      title: "Financial Preferences",
      description: "Base currency, financial-year preferences, and default choices.",
      href: "/settings/financial-preferences",
      cta: "Open Financial Preferences",
    },
    {
      title: "Planning Assumptions",
      description: "Assumption presets and defaults used in long-term planning.",
      href: "/settings/planning-assumptions",
      cta: "Open Planning Assumptions",
    },
    {
      title: "System",
      description: "System-level controls, integrations, and platform settings.",
      href: "/settings/system",
      cta: "Open System",
    },
  ];

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="Settings" description="Control preferences, integrations, and account configuration from a central place." />
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
              <p className="text-sm text-slate-600">Some areas are placeholders and currently marked as Coming Soon.</p>
            </ContentCard>
          </div>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
