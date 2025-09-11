import { test, expect } from '@playwright/test';

const anonProbe = async (request: any, path: string) =>
  (await request.get(path)).status();

test('anon cannot read sensitive objects', async ({ request }) => {
  const endpoints = [
    '/rest/v1/subscriber_public?select=*',
    '/rest/v1/users?select=id',
    '/rest/v1/organizations?select=id',
    '/rest/v1/subscribers_audit?select=id'
  ];
  for (const ep of endpoints) {
    const s = await anonProbe(request, ep);
    expect([401,403]).toContain(s);
  }
});