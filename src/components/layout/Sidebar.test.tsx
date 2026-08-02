import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { Sidebar } from "./Sidebar";

vi.mock("next/link", () => ({
  default: ({ children, href, className }: { children: unknown; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe("Sidebar Planning Links", () => {
  it("includes Fixed Projection and Rolling Projection in Planning links", () => {
    const html = renderToStaticMarkup(<Sidebar activeHref="/planning" collapsed={false} />);

    expect(html).toContain("My Financial Plan");
    expect(html).toContain("Fixed Projection");
    expect(html).toContain("Rolling Projection");
    expect(html).toContain("/planning/fixed-projection");
    expect(html).toContain("/planning/rolling-projection");
  });
});
