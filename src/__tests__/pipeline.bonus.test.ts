import { describe, it, expect } from "vitest";
import { generate } from "../lib/pipeline";

describe("Bonus — revision boundary", () => {
  it("succeeds when review passes on the final allowed revision", async () => {
    const res = await generate({
      behavior: "ok",
      advanceToNextStage: async () => {
        /* hand-off succeeds */
      },
      reviewPasses: (attempt) => attempt === 3,
    });

    expect(res).toEqual({
      status: "ok",
      attempts: 3,
    });
  });
});
