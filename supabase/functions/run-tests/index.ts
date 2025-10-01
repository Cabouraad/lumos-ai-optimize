// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

async function runDenoTest(testFile: string): Promise<{ passed: boolean; output: string; duration: number }> {
  const start = Date.now();
  try {
    const command = new Deno.Command("deno", {
      args: ["test", "--allow-env", "--allow-net", testFile],
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await command.output();
    const output = new TextDecoder().decode(stdout) + new TextDecoder().decode(stderr);
    const duration = Date.now() - start;

    return {
      passed: code === 0,
      output,
      duration,
    };
  } catch (error) {
    return {
      passed: false,
      output: `Error running test: ${error}`,
      duration: Date.now() - start,
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = req.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }

    const jwt = auth.slice("Bearer ".length);
    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    // Verify user
    const { data: me, error: authErr } = await userClient.auth.getUser();
    if (authErr || !me?.user) {
      return jsonResponse({ error: "auth failed" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const suite = body?.suite || "quick";

    const testFiles: Record<string, string[]> = {
      quick: [
        "supabase/functions/__tests__/generate-visibility-recommendations.test.ts",
        "supabase/functions/__tests__/run-prompt-now.test.ts",
        "supabase/functions/__tests__/llms-generate.test.ts",
        "supabase/functions/__tests__/diag.test.ts",
      ],
      all: [
        "supabase/functions/__tests__/generate-visibility-recommendations.test.ts",
        "supabase/functions/__tests__/run-prompt-now.test.ts",
        "supabase/functions/__tests__/llms-generate.test.ts",
        "supabase/functions/__tests__/diag.test.ts",
      ],
    };

    const filesToTest = testFiles[suite] || testFiles.quick;
    const results = [];

    for (const file of filesToTest) {
      const testName = file.split("/").pop()?.replace(".test.ts", "") || file;
      console.log(`Running test: ${testName}`);
      
      const result = await runDenoTest(file);
      results.push({
        name: testName,
        passed: result.passed,
        output: result.output,
        duration: result.duration,
      });
    }

    const summary = {
      total: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      duration: results.reduce((sum, r) => sum + r.duration, 0),
    };

    return jsonResponse({
      success: true,
      suite,
      summary,
      results,
    });
  } catch (error) {
    console.error("Error:", error);
    return jsonResponse({ error: String(error) }, 500);
  }
});
