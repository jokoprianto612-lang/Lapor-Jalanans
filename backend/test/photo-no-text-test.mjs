// Test: send photo without text (the bug from screenshot)
const BASE = 'http://localhost:3001/api/v1';

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
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
  console.log('=== Test: Photo without text ===\n');

  const login = await api('POST', '/auth/login', {
    email: 'admin@laporjalan.id',
    password: 'rahasia123'
  });
  const token = login.body.data.token;
  console.log('Login OK');

  const session = await api('POST', '/chat/sessions', { title: 'Photo Test' }, token);
  const sid = session.body.data.session.id;
  console.log('Session created');

  // 1x1 PNG base64
  const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  console.log('\nSending photo without text...');
  const startTime = Date.now();
  const msg = await api('POST', `/chat/sessions/${sid}/messages`, {
    message: '',
    images: [testImage]
  }, token);
  const duration = Date.now() - startTime;

  console.log(`STATUS: ${msg.status}`);
  console.log(`DURATION: ${duration}ms`);

  if (msg.status === 200) {
    console.log('ANSWER:', msg.body.data.message.substring(0, 300));
    console.log('AI_ANALYSIS:', msg.body.data.aiAnalysis ? 'present' : 'null');
    console.log('AUTHORITIES:', msg.body.data.authorities?.length || 0);
    console.log('VERDICT: FIXED ✓');
  } else {
    console.log('ERROR:', JSON.stringify(msg.body).substring(0, 300));
    console.log('VERDICT: STILL BROKEN ✗');
  }

  // Cleanup
  await api('DELETE', `/chat/sessions/${sid}`, null, token);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
