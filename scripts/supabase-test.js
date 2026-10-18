try { process.loadEnvFile('.env'); } catch {}

async function testSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('[-] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env');
    process.exit(1);
  }

  console.log('====================================================');
  console.log('⚡ ZAYAPAY — SUPABASE CONNECTION DIAGNOSTIC');
  console.log('====================================================');
  console.log(`[+] Endpoint: ${supabaseUrl}`);

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    console.log('[✓] Supabase REST API connection: SUCCESS (200 OK)');
    
    // Check available tables
    const tablePaths = Object.keys(data.paths || {}).filter(p => p !== '/');
    if (tablePaths.length === 0) {
      console.log('\n[ℹ] Status: Connected to Supabase, but no tables exist in public schema yet.');
      console.log('    ➔ Please open your Supabase SQL Editor and run `packages/db/src/schema.sql`');
      console.log(`    ➔ Direct SQL Editor link: https://supabase.com/dashboard/project/xyysscudrgeznucyhugp/sql/new`);
    } else {
      console.log(`[✓] Detected ${tablePaths.length} tables in Supabase:`);
      tablePaths.forEach(t => console.log(`    • ${t.replace('/', '')}`));
    }
  } catch (err) {
    console.error('[-] Connection failed:', err.message);
  }
  console.log('====================================================');
}

testSupabase();
