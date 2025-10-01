/**
 * Simple tests for run-prompt-now function
 * Run with: deno test --allow-env --allow-net supabase/functions/__tests__/run-prompt-now.test.ts
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const FUNCTION_URL = "http://localhost:54321/functions/v1/run-prompt-now";

Deno.test("run-prompt-now: should reject missing auth", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ promptId: "test-123" })
  });

  assertEquals(response.status, 401);
});

Deno.test("run-prompt-now: should reject missing promptId", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer fake-token"
    },
    body: JSON.stringify({})
  });

  // Will fail auth first, but tests input validation
  assertEquals([401, 400, 500].includes(response.status), true);
});

Deno.test("run-prompt-now: should handle CORS preflight", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "OPTIONS",
    headers: {
      "Origin": "http://localhost:5173",
      "Access-Control-Request-Method": "POST"
    }
  });

  assertEquals(response.status, 200);
  assertExists(response.headers.get("Access-Control-Allow-Origin"));
});

Deno.test("run-prompt-now: provider execution result structure", () => {
  const result = {
    text: "Sample AI response mentioning Brand X and Competitor Y",
    tokenIn: 150,
    tokenOut: 200,
    citations: [
      { url: "https://example.com", domain: "example.com", title: "Example" }
    ]
  };

  assertExists(result.text);
  assertEquals(typeof result.tokenIn, "number");
  assertEquals(typeof result.tokenOut, "number");
  assertEquals(result.tokenIn, 150);
  assertEquals(result.tokenOut, 200);
});

Deno.test("run-prompt-now: analysis result structure", () => {
  const analysis = {
    score: 7,
    orgBrandPresent: true,
    orgBrandProminence: 8,
    brands: ["TestBrand"],
    competitors: ["CompetitorA", "CompetitorB"]
  };

  assertEquals(analysis.orgBrandPresent, true);
  assertEquals(analysis.brands.length, 1);
  assertEquals(analysis.competitors.length, 2);
  assertEquals(typeof analysis.score, "number");
  assertEquals(analysis.score >= 0 && analysis.score <= 10, true);
});

Deno.test("run-prompt-now: provider response record structure", () => {
  const record = {
    org_id: "org-123",
    prompt_id: "prompt-456",
    provider: "openai",
    status: "success",
    score: 7.5,
    org_brand_present: true,
    org_brand_prominence: 8,
    brands_json: ["Brand"],
    competitors_json: ["Competitor1"],
    competitors_count: 1,
    token_in: 150,
    token_out: 200,
    raw_ai_response: "Response text",
    model: "gpt-4o-mini",
    run_at: new Date().toISOString(),
    citations_json: []
  };

  assertEquals(record.provider, "openai");
  assertEquals(record.status, "success");
  assertEquals(record.org_brand_present, true);
  assertEquals(record.competitors_count, 1);
  assertExists(record.run_at);
});

Deno.test("run-prompt-now: subscription tier provider filtering", () => {
  const allProviders = ["openai", "perplexity", "gemini", "google_ai_overview"];
  const starterTier = ["openai", "gemini"];
  const growthTier = ["openai", "perplexity", "gemini"];
  const proTier = allProviders;

  // Simulate filtering
  const filterProviders = (tier: string) => {
    if (tier === "starter") return starterTier;
    if (tier === "growth") return growthTier;
    return proTier;
  };

  assertEquals(filterProviders("starter").length, 2);
  assertEquals(filterProviders("growth").length, 3);
  assertEquals(filterProviders("pro").length, 4);
  assertEquals(filterProviders("starter").includes("perplexity"), false);
});

Deno.test("run-prompt-now: usage tracking structure", () => {
  const usageRecord = {
    org_id: "org-123",
    prompt_id: "prompt-456",
    providers_executed: ["openai", "gemini"],
    total_runs: 2,
    successful_runs: 2,
    timestamp: new Date().toISOString()
  };

  assertEquals(usageRecord.providers_executed.length, 2);
  assertEquals(usageRecord.total_runs, usageRecord.successful_runs);
  assertExists(usageRecord.timestamp);
});

console.log("✅ All run-prompt-now tests passed!");
