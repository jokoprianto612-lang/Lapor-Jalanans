// Test chat agent with LLM — verifies NVIDIA LLM integration works via HTTP API
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
  try { json = JSON.parse(text); } catch { json = text.substring(0, 200); }
  return { status: res.status, body: json };
}

async function main() {
  console.log('=== Chat Agent LLM Test ===\n');

  // Login
  const login = await api('POST', '/auth/login', {
    email: 'admin@laporjalan.id',
    password: 'rahasia123'
  });
  if (login.status !== 200) {
    console.log('LOGIN FAILED:', JSON.stringify(login.body).substring(0, 200));
    process.exit(1);
  }
  const token = login.body.data.token;
  console.log('Login OK');

  // Create session
  const session = await api('POST', '/chat/sessions', { title: 'Test Masyarakat' }, token);
  const sid = session.body.data.session.id;
  console.log('Session created');

  // Send message
  console.log('\nSending message to agent...');
  const startTime = Date.now();
  const msg = await api('POST', `/chat/sessions/${sid}/messages`, {
    message: 'Halo, saya mau lapor lubang di jalan Sudirman, kira-kira dilapor ke siapa ya?'
  }, token);
  const duration = Date.now() - startTime;

  console.log(`\nSTATUS: ${msg.status}`);
  console.log(`DURATION: ${duration}ms`);
  console.log(`\nANSWER:\n${msg.body.data.message}`);
  console.log(`\nTOOL_CALLS: ${msg.body.data.metadata?.toolCalls?.length || 0}`);
  console.log(`TOOL_NAMES: ${msg.body.data.metadata?.toolCalls?.map(t => t.name).join(', ') || 'none'}`);
  console.log(`AUTHORITIES: ${msg.body.data.authorities?.length || 0}`);
  console.log(`STEPS: ${msg.body.data.metadata?.steps?.length || 0}`);

  // Cleanup
  const del = await api('DELETE', `/chat/sessions/${sid}`, null, token);
  console.log(`\nCLEANUP: ${del.status}`);

  // Verdict
  const isLLM = msg.body.data.metadata?.toolCalls?.length > 0 ||
                msg.body.data.metadata?.steps?.length > 0 ||
                !msg.body.data.message?.includes('Berikut informasi yang relevan');
  console.log(`\nVERDICT: ${isLLM ? 'LLM ACTIVE ✓' : 'RAG FALLBACK ✗'}`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
