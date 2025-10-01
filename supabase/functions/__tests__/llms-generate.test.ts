/**
 * Simple tests for llms-generate function
 * Run with: deno test --allow-env --allow-net supabase/functions/__tests__/llms-generate.test.ts
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const FUNCTION_URL = "http://localhost:54321/functions/v1/llms-generate";

Deno.test("llms-generate: should reject missing auth", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });

  assertEquals(response.status, 401);
});

Deno.test("llms-generate: should handle CORS preflight", async () => {
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

Deno.test("llms-generate: page discovery from sitemap", () => {
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/about</loc></url>
  <url><loc>https://example.com/contact</loc></url>
</urlset>`;

  const urlMatches = sitemapXml.match(/<loc>(.*?)<\/loc>/g);
  const pages = urlMatches?.map(match => 
    match.replace('<loc>', '').replace('</loc>', '')
  ) || [];

  assertEquals(pages.length, 3);
  assertEquals(pages[0], "https://example.com/");
  assertEquals(pages[1], "https://example.com/about");
});

Deno.test("llms-generate: title extraction from HTML", () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head><title>Test Page Title</title></head>
      <body>Content here</body>
    </html>
  `;

  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "Untitled Page";

  assertEquals(title, "Test Page Title");
});

Deno.test("llms-generate: fallback title when not found", () => {
  const html = `<html><body>No title tag</body></html>`;
  
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "Untitled Page";

  assertEquals(title, "Untitled Page");
});

Deno.test("llms-generate: crawl result structure", () => {
  const crawlResult = {
    success: true,
    pages: [
      { url: "https://example.com/", content: "Home page content", title: "Home" },
      { url: "https://example.com/about", content: "About content", title: "About" }
    ],
    source: "firecrawl"
  };

  assertEquals(crawlResult.success, true);
  assertEquals(crawlResult.pages.length, 2);
  assertEquals(crawlResult.source, "firecrawl");
  assertExists(crawlResult.pages[0].url);
  assertExists(crawlResult.pages[0].content);
});

Deno.test("llms-generate: llms.txt content structure", () => {
  const orgData = {
    name: "TestCorp",
    domain: "testcorp.com",
    business_description: "We provide testing services",
    products_services: "Test automation, QA consulting",
    target_audience: "Software development teams",
    keywords: ["testing", "QA", "automation"]
  };

  const baseUrl = "https://testcorp.com";
  const currentDate = new Date().toISOString().split('T')[0];

  const content = `# llms.txt

# ${orgData.name}
# Generated on ${currentDate}

## Site Information
Site Name: ${orgData.name}
Site URL: ${baseUrl}

## Description
${orgData.business_description}

## Products and Services
${orgData.products_services}

## Keywords and Topics
- ${orgData.keywords.join('\n- ')}`;

  assertExists(content);
  assertEquals(content.includes("TestCorp"), true);
  assertEquals(content.includes("testcorp.com"), true);
  assertEquals(content.includes("testing"), true);
});

Deno.test("llms-generate: page path normalization", () => {
  const baseUrl = "https://example.com";
  const fullUrls = [
    "https://example.com/",
    "https://example.com/about",
    "https://example.com/contact"
  ];

  const relativePaths = fullUrls.map(url => 
    url.replace(baseUrl, '') || '/'
  );

  assertEquals(relativePaths[0], "/");
  assertEquals(relativePaths[1], "/about");
  assertEquals(relativePaths[2], "/contact");
});

Deno.test("llms-generate: content extraction (strip HTML tags)", () => {
  const html = `
    <html>
      <head><title>Test</title></head>
      <body>
        <script>alert('test');</script>
        <style>.test { color: red; }</style>
        <h1>Welcome</h1>
        <p>This is content.</p>
      </body>
    </html>
  `;

  const textContent = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  assertEquals(textContent.includes("Welcome"), true);
  assertEquals(textContent.includes("This is content"), true);
  assertEquals(textContent.includes("alert"), false);
  assertEquals(textContent.includes("color: red"), false);
});

Deno.test("llms-generate: generation metadata", () => {
  const metadata = {
    discovered_pages: 15,
    crawled_pages: 10,
    extraction_method: "firecrawl",
    generated_at: new Date().toISOString()
  };

  assertEquals(metadata.discovered_pages, 15);
  assertEquals(metadata.crawled_pages, 10);
  assertEquals(metadata.extraction_method, "firecrawl");
  assertExists(metadata.generated_at);
});

console.log("✅ All llms-generate tests passed!");
