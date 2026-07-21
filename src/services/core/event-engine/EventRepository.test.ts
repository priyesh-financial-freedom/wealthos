import { describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  supabase: null as null,
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: runtime.supabase,
}));

import { EventRepository } from "./EventRepository";

describe("EventRepository", () => {
  it("throws when supabase client is not configured", async () => {
    const repository = new EventRepository();
    await expect(repository.listEvents()).rejects.toThrowError("Supabase client is not configured.");
  });
});
