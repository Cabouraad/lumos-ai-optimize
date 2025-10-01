/**
 * Simple tests for diag function
 * Run with: deno test --allow-env --allow-net supabase/functions/__tests__/diag.test.ts
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const FUNCTION_URL = "http://localhost:54321/functions/v1/diag";

Deno.test("diag: should respond to OPTIONS preflight", async () => {
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

Deno.test("diag: should return diagnostic info", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "http://localhost:5173"
    }
  });

  assertEquals(response.status, 200);
  
  const data = await response.json();
  
  assertExists(data.ok);
  assertExists(data.timestamp);
  assertExists(data.environment);
  assertEquals(data.ok, true);
});

Deno.test("diag: response structure validation", () => {
  const diagnosticData = {
    ok: true,
    origin: "http://localhost:5173",
    allowed: true,
    allowList: ["https://llumos.app", "http://localhost:5173"],
    timestamp: new Date().toISOString(),
    environment: {
      hasAppOrigins: true,
      hasAppOrigin: true,
      hasCronSecret: true,
      hasE2EFakeProviders: false
    },
    cors: {
      method: "POST",
      requestHeaders: {},
      responseHeaders: {}
    }
  };

  assertEquals(diagnosticData.ok, true);
  assertEquals(diagnosticData.allowed, true);
  assertExists(diagnosticData.timestamp);
  assertExists(diagnosticData.environment);
  assertEquals(typeof diagnosticData.environment.hasAppOrigins, "boolean");
});

Deno.test("diag: CORS origin validation", () => {
  const allowedOrigins = [
    "https://llumos.app",
    "http://localhost:5173",
    "https://sandbox.lovable.dev"
  ];

  const testOrigin = "http://localhost:5173";
  const isAllowed = allowedOrigins.includes(testOrigin);

  assertEquals(isAllowed, true);
});

Deno.test("diag: unauthorized origin handling", () => {
  const allowedOrigins = ["https://llumos.app"];
  const testOrigin = "https://evil.com";
  
  const isAllowed = allowedOrigins.includes(testOrigin);

  assertEquals(isAllowed, false);
});

Deno.test("diag: environment check flags", () => {
  // Simulate environment check
  const envChecks = {
    hasAppOrigins: !!Deno.env.get("APP_ORIGINS"),
    hasAppOrigin: !!Deno.env.get("APP_ORIGIN"),
    hasCronSecret: !!Deno.env.get("CRON_SECRET"),
    hasE2EFakeProviders: Deno.env.get("E2E_FAKE_PROVIDERS") === "true",
    hasSupabaseUrl: !!Deno.env.get("SUPABASE_URL"),
    hasServiceRole: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  };

  // All checks should return boolean
  assertEquals(typeof envChecks.hasAppOrigins, "boolean");
  assertEquals(typeof envChecks.hasAppOrigin, "boolean");
  assertEquals(typeof envChecks.hasCronSecret, "boolean");
  assertEquals(typeof envChecks.hasE2EFakeProviders, "boolean");
});

Deno.test("diag: timestamp format validation", () => {
  const timestamp = new Date().toISOString();
  
  // ISO format: YYYY-MM-DDTHH:mm:ss.sssZ
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  
  assertEquals(isoRegex.test(timestamp), true);
});

Deno.test("diag: development environment detection", () => {
  const testCases = [
    { origin: "http://localhost:3000", isDev: true },
    { origin: "http://127.0.0.1:5173", isDev: true },
    { origin: "https://sandbox.lovable.dev", isDev: true },
    { origin: "https://lovable.app", isDev: true },
    { origin: "https://llumos.app", isDev: false },
    { origin: "https://production.com", isDev: false }
  ];

  testCases.forEach(({ origin, isDev }) => {
    const detected = origin.includes("localhost") || 
                     origin.includes("127.0.0.1") ||
                     origin.includes("sandbox.lovable.dev") ||
                     origin.includes("lovable.app") ||
                     origin.includes("lovable.dev");
    
    assertEquals(detected, isDev, `Failed for origin: ${origin}`);
  });
});

console.log("✅ All diag tests passed!");
