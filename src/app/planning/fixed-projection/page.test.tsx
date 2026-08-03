import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import FixedProjectionPage from "./page";

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: unknown }) => <div>{children}</div>,
}));

vi.mock("@/components/layout/PageContainer", () => ({
  PageContainer: ({ children }: { children: unknown }) => <div>{children}</div>,
}));

vi.mock("@/components/layout/ContentCard", () => ({
  ContentCard: ({ children }: { children: unknown }) => <section>{children}</section>,
}));

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title, description, summary }: { title: string; description: string; summary?: string }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
      <p>{summary}</p>
    </header>
  ),
}));

vi.mock("@/components/layout/EmptyState", () => ({
  EmptyState: ({ title, description }: { title: string; description: string }) => (
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: unknown }) => <button type="button">{children}</button>,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: unknown; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock("@/services/projection/ProjectionReadService", () => ({
  createProjectionReadServerService: () => ({
    getLatestLockedFixedProjection: async () => null,
  }),
}));

vi.mock("@/services/planning/assumptions/server", () => ({
  createPlanningAssumptionServerService: () => ({
    getFamilyProfile: async () => ({ primaryCurrentAge: 60 }),
    getEffectiveAssumptions: async () => ({ retirementAge: 68 }),
  }),
}));

describe("Planning Fixed Projection Page", () => {
  it("renders header and empty state", async () => {
    const html = renderToStaticMarkup(await FixedProjectionPage());

    expect(html).toContain("Fixed Projection");
    expect(html).toContain("No Fixed Projection has been generated yet.");
  });
});
