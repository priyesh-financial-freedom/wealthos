import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import RollingProjectionPage from "./page";

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

vi.mock("./RollingProjectionWorkflow", () => ({
  RollingProjectionWorkflow: ({ lockedProjection }: { lockedProjection: unknown }) => (
    <div>{lockedProjection == null ? "No Rolling Projection is available yet." : "Rolling Projection Loaded"}</div>
  ),
}));

vi.mock("@/services/projection/ProjectionReadService", () => ({
  createProjectionReadServerService: () => ({
    getLatestLockedRollingProjection: async () => null,
  }),
}));

describe("Planning Rolling Projection Page", () => {
  it("renders header and empty state", async () => {
    const html = renderToStaticMarkup(await RollingProjectionPage());

    expect(html).toContain("Rolling Projection");
    expect(html).toContain("No Rolling Projection is available yet.");
  });
});
