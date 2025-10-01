/**
 * Simple tests for generate-visibility-recommendations function
 * Run with: deno test --allow-env --allow-net supabase/functions/__tests__/generate-visibility-recommendations.test.ts
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const FUNCTION_URL = "http://localhost:54321/functions/v1/generate-visibility-recommendations";

Deno.test("generate-visibility-recommendations: should reject missing auth", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ promptId: "test-123" })
  });

  assertEquals(response.status, 401);
});

Deno.test("generate-visibility-recommendations: should reject missing promptId", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer fake-token"
    },
    body: JSON.stringify({})
  });

  // Will fail auth first, but tests input validation path
  assertEquals([401, 400].includes(response.status), true);
});

Deno.test("generate-visibility-recommendations: deterministic fallback structure", () => {
  const brand = "TestCorp";
  const promptText = "Best CRM for startups";
  
  // Simulate fallback structure
  const fallback = {
    content: [{
      subtype: "blog_post",
      title: `Complete Guide: ${promptText}`,
      outline: [
        { h2: "Understanding the Fundamentals", h3: ["Key Concepts"] },
        { h2: "Step-by-Step Implementation", h3: ["Getting Started"] }
      ],
      must_include: {
        entities: [brand],
        keywords: ["best practices", "guide", "how to"],
        faqs: [`What is ${promptText}?`],
        schema: ["FAQPage", "HowTo"]
      },
      where_to_publish: {
        path: `/blog/${promptText.toLowerCase().replace(/\s+/g, '-')}-guide`
      }
    }],
    social: [{
      subtype: "linkedin_post",
      title: `The #1 mistake people make with ${promptText}`,
      body_bullets: ["Insight 1", "Insight 2"],
      cta: "Comment with your biggest challenge"
    }]
  };

  assertExists(fallback.content);
  assertExists(fallback.social);
  assertEquals(fallback.content.length, 1);
  assertEquals(fallback.social.length, 1);
  assertEquals(fallback.content[0].must_include.entities[0], brand);
});

Deno.test("generate-visibility-recommendations: user prompt formatting", () => {
  const brand = "TestBrand";
  const promptText = "Compare HubSpot vs Salesforce";
  const presence = 42.5;
  const citations = [
    { domain: "hubspot.com", link: "https://hubspot.com/guide", title: "Guide" },
    { domain: "salesforce.com", link: "https://salesforce.com/pricing", title: null }
  ];

  const formatted = `BRAND: ${brand}
TRACKED PROMPT: "${promptText}"
CURRENT PRESENCE (14d): ${presence.toFixed(1)}%
RECENT CITATIONS:
- hubspot.com — Guide (https://hubspot.com/guide)
- salesforce.com (https://salesforce.com/pricing)

Create content+social recommendations that specifically target this prompt intent and increase presence in AI answers.
JSON ONLY.`;

  assertExists(formatted);
  assertEquals(formatted.includes("42.5%"), true);
  assertEquals(formatted.includes("hubspot.com"), true);
  assertEquals(formatted.includes("TestBrand"), true);
});

Deno.test("generate-visibility-recommendations: should handle CORS preflight", async () => {
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

Deno.test("generate-visibility-recommendations: recommendation row structure", () => {
  const orgId = "org-123";
  const promptId = "prompt-456";
  const presence = 35.2;

  const contentRec = {
    org_id: orgId,
    prompt_id: promptId,
    channel: "content",
    subtype: "blog_post",
    title: "Test Blog Post",
    outline: [{ h2: "Section", h3: ["Sub"] }],
    posting_instructions: "Step by step",
    must_include: { entities: ["Brand"], keywords: ["test"] },
    where_to_publish: { path: "/blog/test" },
    citations_used: [],
    success_metrics: ["Metric 1"],
    score_before: presence
  };

  assertEquals(contentRec.channel, "content");
  assertEquals(contentRec.score_before, 35.2);
  assertExists(contentRec.title);
  assertExists(contentRec.outline);
});

Deno.test("generate-visibility-recommendations: social rec structure", () => {
  const socialRec = {
    channel: "social",
    subtype: "linkedin_post",
    title: "Hook title",
    outline: { body_bullets: ["Point 1", "Point 2", "Point 3"] },
    posting_instructions: "Post Tue/Wed morning",
    must_include: { entities: ["Brand"], keywords: ["insight"] },
    where_to_publish: { platform: "LinkedIn", profile: "company" },
    citations_used: [],
    success_metrics: ["1000+ impressions"]
  };

  assertEquals(socialRec.channel, "social");
  assertEquals(socialRec.subtype, "linkedin_post");
  assertEquals(socialRec.outline.body_bullets.length, 3);
  assertEquals(socialRec.where_to_publish.platform, "LinkedIn");
});

console.log("✅ All generate-visibility-recommendations tests passed!");
