import { extractJson } from "./extract-json";
import { mockStream, type MockBehavior, type MockState } from "./anthropic-mock";

export interface GenerateInput {
  /** Drives the mock streaming client (see anthropic-mock.ts). */
  behavior: MockBehavior;
  /** Hands the finished draft to the next pipeline stage. May reject. */
  advanceToNextStage: () => Promise<void>;
  /** Returns true once the draft passes review. Scripted by callers/tests. */
  reviewPasses: (attempt: number) => boolean;
}

export interface GenerateResult {
  status: "ok" | "error";
  attempts: number;
}

const MAX_REVISIONS = 3;
const MAX_RETRIES = 3;

/**
 * Runs one content-generation pass: stream a draft, extract it, revise until it
 * passes review, then hand off to the next stage.
 *
 * This is a faithful (stripped-down) reproduction of the real pipeline — and it
 * ships with three real bugs from that pipeline. Your job is to fix them so the
 * test suite passes. See the README for the symptoms. (Do not edit the tests.)
 */
export async function generate(input: GenerateInput): Promise<GenerateResult> {
  const state: MockState = { calls: 0 };

  // The model call can fail transiently (rate limits) or return a truncated
  // stream. Try to recover the pipeline run by starting another stream.
  let generationFailed = 0
  for (let retry = 0; retry < MAX_RETRIES; retry++) {
    try {
      const text = await mockStream(input.behavior, state);
      extractJson(text);
      break;
    } catch {
      generationFailed++
    }
  }

  if (generationFailed === MAX_RETRIES) {
    return { status: "error", attempts: 0 }
  }

  // Revise until the draft passes review.
  // Stop after the review limit if the draft doesn't pass review
  let attempt = 0;
  let reviewPassed = input.reviewPasses(attempt)
  while (!reviewPassed && attempt < MAX_REVISIONS) {
    attempt += 1;
    reviewPassed = input.reviewPasses(attempt)
  }

  if (!reviewPassed) {
    return { status: "error", attempts: attempt };
  }

  // Hand off to the next stage and surface any failure.
  try {
    await input.advanceToNextStage();
    return { status: "ok", attempts: attempt };
  } catch {
    return { status: "error", attempts: attempt };
  }
}

export { MAX_REVISIONS };
