import { AppLayout } from "@/components/layout/AppLayout";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { PageContainer } from "@/components/layout/PageContainer";

export default function Loading() {
  return (
    <AppLayout>
      <PageContainer>
        <ContentContainer className="border-none bg-transparent p-0 shadow-none">
          <div className="space-y-8 animate-pulse">
            <div className="h-52 rounded-3xl bg-slate-100" />
            <section className="grid gap-7 xl:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-72 rounded-3xl bg-slate-100" />
              ))}
            </section>
          </div>
        </ContentContainer>
      </PageContainer>
    </AppLayout>
  );
}
