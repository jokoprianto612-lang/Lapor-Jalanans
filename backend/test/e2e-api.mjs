// E2E API Test Script v2 — uses correct routes, prints status only
const BASE = 'http://localhost:3001/api/v1';

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text.substring(0, 300); }
  return { status: res.status, body: json };
}

async function main() {
  console.log('=== Lapor Jalan E2E API Test v2 ===\n');

  // 1. Health (root, not under /api/v1)
  const healthRes = await fetch('http://localhost:3001/health');
  console.log(`[${healthRes.status}] GET /health ${healthRes.status === 200 ? 'OK' : 'FAIL'}`);

  // 2. Login
  const login = await api('POST', '/auth/login', {
    email: 'admin@laporjalan.id',
    password: 'rahasia123'
  });
  console.log(`[${login.status}] POST /auth/login ${login.status === 200 ? 'OK' : 'FAIL'}`);
  if (login.status !== 200) { console.log('  ERROR:', JSON.stringify(login.body).substring(0, 200)); process.exit(1); }
  const token = login.body.data.token;
  const userId = login.body.data.user.id;

  // 3. Get current user
  const me = await api('GET', '/auth/me', null, token);
  console.log(`[${me.status}] GET /auth/me ${me.status === 200 ? 'OK' : 'FAIL'}`);

  // 4. Create chat session
  const session = await api('POST', '/chat/sessions', { title: 'Test Session' }, token);
  console.log(`[${session.status}] POST /chat/sessions ${session.status === 201 ? 'OK' : 'FAIL'}`);
  if (session.status !== 201) { console.log('  ERROR:', JSON.stringify(session.body).substring(0, 200)); process.exit(1); }
  const sessionId = session.body.data.session.id;

  // 5. Send message to agent
  const msg = await api('POST', `/chat/sessions/${sessionId}/messages`, {
    message: 'Halo, saya mau lapor lubang di jalan'
  }, token);
  console.log(`[${msg.status}] POST /chat/sessions/:id/messages ${msg.status === 200 ? 'OK' : 'FAIL'}`);
  if (msg.status === 200) {
    console.log(`  answer: ${msg.body.data.message.substring(0, 80)}...`);
    console.log(`  toolCalls: ${msg.body.data.metadata?.toolCalls?.length || 0}`);
  }

  // 6. Get session messages
  const messages = await api('GET', `/chat/sessions/${sessionId}`, null, token);
  console.log(`[${messages.status}] GET /chat/sessions/:id ${messages.status === 200 ? 'OK' : 'FAIL'}`);

  // 7. List sessions
  const sessions = await api('GET', '/chat/sessions', null, token);
  console.log(`[${sessions.status}] GET /chat/sessions ${sessions.status === 200 ? 'OK' : 'FAIL'}`);

  // 8. Get my reports (correct route: /reports/my)
  const myReports = await api('GET', '/reports/my', null, token);
  console.log(`[${myReports.status}] GET /reports/my ${myReports.status === 200 ? 'OK' : 'FAIL'}`);

  // 9. Get authorities nearby (correct route: POST /authorities/nearby)
  const nearby = await api('POST', '/authorities/nearby', {
    latitude: -6.2, longitude: 106.8, damageType: 'POTHOLE', limit: 3
  }, token);
  console.log(`[${nearby.status}] POST /authorities/nearby ${nearby.status === 200 ? 'OK' : 'FAIL'}`);

  // 10. Get authority types
  const types = await api('GET', '/authorities/types', null, token);
  console.log(`[${types.status}] GET /authorities/types ${types.status === 200 ? 'OK' : 'FAIL'}`);

  // 11. Get public info
  const pubInfo = await api('GET', '/public/info');
  console.log(`[${pubInfo.status}] GET /public/info ${pubInfo.status === 200 ? 'OK' : 'FAIL'}`);

  // 12. Get agent config
  const config = await api('GET', '/chat/config', null, token);
  console.log(`[${config.status}] GET /chat/config ${config.status === 200 ? 'OK' : 'FAIL'}`);

  // 13. Get memory stats
  const memStats = await api('GET', '/chat/memory/stats', null, token);
  console.log(`[${memStats.status}] GET /chat/memory/stats ${memStats.status === 200 ? 'OK' : 'FAIL'}`);

  // 14. Analyze image (with valid 1x1 PNG base64)
  const imgAnalysis = await api('POST', '/chat/analyze-image', {
    image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  }, token);
  console.log(`[${imgAnalysis.status}] POST /chat/analyze-image ${imgAnalysis.status === 200 ? 'OK' : 'FAIL'}`);

  // 15. Create report directly (POST /reports) — with valid image
  const report = await api('POST', '/reports', {
    title: 'Lubang di Jalan Test E2E',
    description: 'Lubang besar di jalan utama, perlu perbaikan segera',
    damageType: 'POTHOLE',
    severity: 'HIGH',
    latitude: -6.2,
    longitude: 106.8,
    address: 'Jl. Test E2E No. 1',
    images: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==']
  }, token);
  console.log(`[${report.status}] POST /reports ${report.status === 201 ? 'OK' : 'FAIL'}`);
  if (report.status === 201) {
    console.log(`  trackingCode: ${report.body.data.report.trackingCode}`);
  } else {
    console.log('  ERROR:', JSON.stringify(report.body).substring(0, 300));
  }

  // 16. Submit report from chat session
  const submit = await api('POST', `/chat/sessions/${sessionId}/submit-report`, {
    title: 'Lubang di Jalan Test',
    description: 'Lubang besar di jalan utama',
    damageType: 'POTHOLE',
    severity: 'HIGH',
    latitude: -6.2,
    longitude: 106.8,
    address: 'Jl. Test No. 1',
    images: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='],
    aiAnalysis: null
  }, token);
  console.log(`[${submit.status}] POST /chat/sessions/:id/submit-report ${submit.status === 200 ? 'OK' : 'FAIL'}`);
  if (submit.status !== 200) {
    console.log('  ERROR:', JSON.stringify(submit.body).substring(0, 300));
  }

  // 17. Delete session
  const del = await api('DELETE', `/chat/sessions/${sessionId}`, null, token);
  console.log(`[${del.status}] DELETE /chat/sessions/:id ${del.status === 200 ? 'OK' : 'FAIL'}`);

  // 18. Unauthorized access (no token)
  const unauth = await api('GET', '/reports/my');
  console.log(`[${unauth.status}] GET /reports/my (no token) ${unauth.status === 401 ? 'OK' : 'FAIL'}`);

  // 19. Invalid login
  const badLogin = await api('POST', '/auth/login', {
    email: 'admin@laporjalan.id',
    password: 'wrongpassword'
  });
  console.log(`[${badLogin.status}] POST /auth/login (wrong pw) ${badLogin.status === 401 ? 'OK' : 'FAIL'}`);

  // 20. Register new user (returns 200 per current auth.ts)
  const reg = await api('POST', '/auth/register', {
    name: 'E2E Test User',
    email: `e2e-${Date.now()}@laporjalan.id`,
    password: `e2e-pass-${Date.now()}`
  });
  console.log(`[${reg.status}] POST /auth/register ${reg.status === 200 ? 'OK' : 'FAIL'}`);

  console.log('\n=== Test Complete ===');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
