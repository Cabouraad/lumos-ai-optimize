/* Audit DB exposure for Llumos.
 * Reads DATABASE_URL (or SUPABASE_DB_URL). Exits 1 if CRITICAL/HIGH findings exist.
 */
import { Client } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!DATABASE_URL) {
  console.error('❌ Missing DATABASE_URL or SUPABASE_DB_URL');
  process.exit(2);
}

(async () => {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const { rows } = await client.query('select * from public.run_security_audit()');
  await client.end();

  if (!rows.length) {
    console.log('✅ No findings.');
    process.exit(0);
  }

  const pad = (s: string, n: number) => (s || '').padEnd(n);
  console.log('🔎 Security audit findings:');
  for (const r of rows) {
    console.log(
      `${pad(r.severity, 8)} ${pad(r.item_kind, 6)} ${pad(r.schema_name+'.'+r.object_name, 40)} | ${r.issue} | ${r.details}`
    );
    console.log(`   ↳ fix: ${r.fix_hint}`);
  }

  const hasCritical = rows.some(r => r.severity === 'CRITICAL');
  const hasHigh     = rows.some(r => r.severity === 'HIGH');
  if (hasCritical || hasHigh) {
    console.error('❌ Failing due to CRITICAL/HIGH findings.');
    process.exit(1);
  }
  console.log('✅ No CRITICAL/HIGH findings.');
})().catch((e) => {
  console.error('❌ Audit error:', e);
  process.exit(2);
});