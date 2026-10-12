const axios = require('axios');

(async () => {
  const results = [];
  const test = (name, fn) => fn().then(r => results.push([name, r])).catch(e => results.push([name, `ERROR: ${e.response?.status} ${e.response?.data?.error?.message || e.message}`]));

  // 1. Admin login
  let adminToken;
  await test('1. Admin login', async () => {
    const res = await axios.post('http://localhost:3004/api/v1/auth/login', { email: 'admin@laporjalan.id', password: 'admin12345' });
    adminToken = res.data.data.token;
    return res.data.success ? 'PASS' : `FAIL: ${res.data?.error?.message}`;
  });

  // 2. Admin dashboard
  await test('2. Admin dashboard', async () => {
    const res = await axios.get('http://localhost:3004/api/v1/admin/dashboard', { headers: { Authorization: 'Bearer ' + adminToken } });
    return res.data.success ? `PASS (users: ${res.data.data?.users?.total})` : `FAIL: ${res.data?.error?.message}`;
  });

  // 3. Admin users list
  await test('3. Admin users', async () => {
    const res = await axios.get('http://localhost:3004/api/v1/admin/users', { headers: { Authorization: 'Bearer ' + adminToken } });
    return res.data.success ? `PASS (${res.data.data?.total} users)` : `FAIL: ${res.data?.error?.message}`;
  });

  // 4. Admin reports list
  await test('4. Admin reports', async () => {
    const res = await axios.get('http://localhost:3004/api/v1/admin/reports', { headers: { Authorization: 'Bearer ' + adminToken } });
    return res.data.success ? `PASS (${res.data.data?.total} reports)` : `FAIL: ${res.data?.error?.message}`;
  });

  // 5. Admin observability metrics
  await test('5. Admin metrics', async () => {
    const res = await axios.get('http://localhost:3004/api/v1/admin/observability/metrics', { headers: { Authorization: 'Bearer ' + adminToken } });
    return res.data.success ? 'PASS' : `FAIL: ${res.data?.error?.message}`;
  });

  // 6. Admin config
  await test('6. Admin config', async () => {
    const res = await axios.get('http://localhost:3004/api/v1/admin/config', { headers: { Authorization: 'Bearer ' + adminToken } });
    return res.data.success ? 'PASS' : `FAIL: ${res.data?.error?.message}`;
  });

  // 7. Admin delete config
  await test('7. Admin delete config', async () => {
    const res = await axios.delete('http://localhost:3004/api/v1/admin/config/test-key', { headers: { Authorization: 'Bearer ' + adminToken } });
    return res.data.success ? 'PASS' : `FAIL: ${res.data?.error?.message}`;
  });

  // 8. Admin update report status
  await test('8. Admin update report status', async () => {
    // First get a report
    const reports = await axios.get('http://localhost:3004/api/v1/admin/reports', { headers: { Authorization: 'Bearer ' + adminToken } });
    const reportId = reports.data.data?.reports?.[0]?.id;
    if (!reportId) return 'SKIP (no reports)';
    const res = await axios.patch('http://localhost:3004/api/v1/admin/reports/' + reportId + '/status', { status: 'VERIFIED', message: 'Verified by admin' }, { headers: { Authorization: 'Bearer ' + adminToken } });
    return res.data.success ? 'PASS' : `FAIL: ${res.data?.error?.message}`;
  });

  // 9. Admin assign report
  await test('9. Admin assign report', async () => {
    const reports = await axios.get('http://localhost:3004/api/v1/admin/reports', { headers: { Authorization: 'Bearer ' + adminToken } });
    const reportId = reports.data.data?.reports?.[0]?.id;
    if (!reportId) return 'SKIP (no reports)';
    // Get admin user as assignee
    const users = await axios.get('http://localhost:3004/api/v1/admin/users', { headers: { Authorization: 'Bearer ' + adminToken } });
    const assigneeId = users.data.data?.users?.[0]?.id;
    if (!assigneeId) return 'SKIP (no users)';
    const res = await axios.post('http://localhost:3004/api/v1/reports/' + reportId + '/assign', { assigneeId }, { headers: { Authorization: 'Bearer ' + adminToken } });
    return res.data.success ? 'PASS' : `FAIL: ${res.data?.error?.message}`;
  });

  // 10. Admin add progress
  await test('10. Admin add progress', async () => {
    const reports = await axios.get('http://localhost:3004/api/v1/admin/reports', { headers: { Authorization: 'Bearer ' + adminToken } });
    const reportId = reports.data.data?.reports?.[0]?.id;
    if (!reportId) return 'SKIP (no reports)';
    const res = await axios.post('http://localhost:3004/api/v1/reports/' + reportId + '/progress', { message: 'Progress update from admin' }, { headers: { Authorization: 'Bearer ' + adminToken } });
    return res.data.success ? 'PASS' : `FAIL: ${res.data?.error?.message}`;
  });

  // 11. Contact links
  await test('11. Contact links', async () => {
    const nearby = await axios.post('http://localhost:3004/api/v1/public/authorities/nearby', { latitude: -6.1944, longitude: 106.8229, damageType: 'POTHOLE' });
    const authId = nearby.data.data?.authorities?.[0]?.id;
    if (!authId) return 'SKIP (no authorities)';
    const res = await axios.get('http://localhost:3004/api/v1/authorities/' + authId + '/contact-links', { headers: { Authorization: 'Bearer ' + adminToken } });
    return res.data.success ? 'PASS' : `FAIL: ${res.data?.error?.message}`;
  });

  // 12. Report tracking (public)
  await test('12. Report tracking', async () => {
    const reports = await axios.get('http://localhost:3004/api/v1/admin/reports', { headers: { Authorization: 'Bearer ' + adminToken } });
    const trackingCode = reports.data.data?.reports?.[0]?.trackingCode;
    if (!trackingCode) return 'SKIP (no reports)';
    const res = await axios.get('http://localhost:3004/api/v1/public/track/' + trackingCode);
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
