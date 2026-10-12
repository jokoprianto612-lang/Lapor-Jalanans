// Admin + full API smoke test.
// Credentials come from env — never hardcoded.
//
// Usage:
//   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='<password>' node test-admin.js
//   BASE_URL=http://localhost:3000 node test-admin.js
require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('FATAL: ADMIN_EMAIL and ADMIN_PASSWORD env vars are required.');
  process.exit(1);
}

(async () => {
  const results = [];
  const test = (name, fn) => fn().then(r => results.push([name, r])).catch(e => results.push([name, `ERROR: ${e.response?.status} ${e.response?.data?.error?.message || e.message}`]));

  // 1. Admin login
  let adminToken;
  await test('1. Admin login', async () => {
    const res = await axios.post(`${BASE_URL}/api/v1/auth/login`, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    adminToken = res.data.data.token;
    return res.data.success ? 'PASS' : `FAIL: ${res.data?.error?.message}`;
  });

  // 2. Admin dashboard
  await test('2. Admin dashboard', async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/admin/dashboard`, { headers: { Authorization: 'Bearer ' + adminToken } });
    return res.data.success ? `PASS (users: ${res.data.data?.users?.total})` : `FAIL: ${res.data?.error?.message}`;
  });

  // 3. Admin users list
  await test('3. Admin users', async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/admin/users`, { headers: { Authorization: 'Bearer ' + adminToken } });
    return res.data.success ? `PASS (${res.data.data?.total} users)` : `FAIL: ${res.data?.error?.message}`;
  });

  // 4. Admin reports list
  await test('4. Admin reports', async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/admin/reports`, { headers: { Authorization: 'Bearer ' + adminToken } });
    return res.data.success ? `PASS (${res.data.data?.total} reports)` : `FAIL: ${res.data?.error?.message}`;
  });

  // 5. Admin observability metrics
  await test('5. Admin metrics', async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/admin/observability/metrics`, { headers: { Authorization: 'Bearer ' + adminToken } });
    return res.data.success ? 'PASS' : `FAIL: ${res.data?.error?.message}`;
  });

  // 6. Admin config
  await test('6. Admin config', async () => {
    const res = await axios.get(`${BASE_URL}/api/v1/admin/config`, { headers: { Authorization: 'Bearer ' + adminToken } });
    return res.data.success ? 'PASS' : `FAIL: ${res.data?.error?.message}`;
  });

  // 7. Report tracking (public)
  await test('7. Report tracking', async () => {
    const reports = await axios.get(`${BASE_URL}/api/v1/admin/reports`, { headers: { Authorization: 'Bearer ' + adminToken } });
    const trackingCode = reports.data.data?.reports?.[0]?.trackingCode;
    if (!trackingCode) return 'SKIP (no reports)';
    const res = await axios.get(`${BASE_URL}/api/v1/public/track/` + trackingCode);
    return res.data.success ? `PASS (${res.data.data?.report?.status})` : `FAIL: ${res.data?.error?.message}`;
  });

  console.log('\n=== ADMIN + FULL TEST RESULTS ===');
  for (const [name, result] of results) {
    console.log(`${name}: ${result}`);
  }
  const passed = results.filter(([, r]) => r.startsWith('PASS')).length;
  const failed = results.filter(([, r]) => r.startsWith('FAIL')).length;
  const skipped = results.filter(([, r]) => r.startsWith('SKIP')).length;
  console.log(`\n${passed}/${results.length} passed, ${failed} failed, ${skipped} skipped`);
})();
