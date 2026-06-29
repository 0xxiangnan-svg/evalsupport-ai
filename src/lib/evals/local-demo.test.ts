import { describe, expect, it } from "vitest";

import { runLocalDemoEval } from "@/lib/evals/local-demo";

describe("local demo eval runner", () => {
  it("scores the fixed 20-case eval set deterministically", async () => {
    const run = await runLocalDemoEval();

    expect(run.status).toBe("completed");
    expect(run.total_cases).toBe(20);
    expect(run.results).toHaveLength(20);
    expect(run.citation_accuracy).toBe(1);
    expect(run.refusal_accuracy).toBe(1);
    expect(run.answer_usability).toBe(1);
    expect(
      run.results.filter((result) => result.category === "answerable"),
    ).toHaveLength(12);
    expect(
      run.results.filter((result) => result.category === "refusal"),
    ).toHaveLength(5);
    expect(
      run.results.filter((result) => result.category === "distractor"),
    ).toHaveLength(3);
  });
});
