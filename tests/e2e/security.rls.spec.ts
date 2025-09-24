import { test, expect } from '@playwright/test';

test('anon cannot read business tables', async ({ request }) => {
  const endpoints = ['prompts','recommendations','subscribers','subscriber_public','low_visibility_prompts'];
  for (const t of endpoints) {
    const res = await request.get(`/rest/v1/${t}?select=id`);
    expect([401,403]).toContain(res.status());
  }
});

test('org isolation for prompts/recommendations/subscribers', async ({ request }) => {
  // helper: loginAs returns an auth header for a seeded user
  async function loginAs(email: string, password: string) {
    const r = await request.post('/auth/v1/token?grant_type=password', {
      data: { email, password },
      headers: { apikey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY! }
    });
    const { access_token } = await r.json();
    return { Authorization: `Bearer ${access_token}`, apikey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY! };
  }

  const hA = await loginAs('ownerA@example.com', 'password'); // seeded user Org A
  const hB = await loginAs('ownerB@example.com', 'password'); // seeded user Org B

  const aPrompts = await request.get('/rest/v1/prompts?select=org_id', { headers: hA });
  const bPrompts = await request.get('/rest/v1/prompts?select=org_id', { headers: hB });
  expect(await aPrompts.json()).toSatisfy(rows => rows.every((r: any) => r.org_id));
  expect(await bPrompts.json()).not.toEqual(await aPrompts.json());

  const aRecs = await request.get('/rest/v1/recommendations?select=org_id', { headers: hA });
  const bRecs = await request.get('/rest/v1/recommendations?select=org_id', { headers: hB });
  expect(await bRecs.json()).not.toEqual(await aRecs.json());

  const aSubs = await request.get('/rest/v1/subscribers?select=org_id', { headers: hA });
  const bSubs = await request.get('/rest/v1/subscribers?select=org_id', { headers: hB });
  expect(await bSubs.json()).not.toEqual(await aSubs.json());
});