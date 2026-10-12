// Smoke test — sengaja TANPA koneksi database:
// memverifikasi perilaku yang selama ini rusak (CSRF memblokir login,
// admin 401, WS broadcast tanpa auth) lewat app.inject tanpa listen port.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Env wajib di-set SEBELUM import index.ts (dia validasi saat load)
process.env.JWT_SECRET = process.env.JWT_SECRET || 'smoke-test-jwt-secret-0123456789abcdefghij';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'smoke-test-session-secret-0123456789abcdefgh';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://user:pass@127.0.0.1:59999/not-used';

const { app } = await import('../src/index.js');

before(async () => {
  await app.ready();
});

after(async () => {
  await app.close();
});

test('GET /health hidup', async () => {
  const res = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().status, 'ok');
});

test('GET /public/info jalan tanpa auth & tanpa DB', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/v1/public/info' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().name, 'Lapor Jalan');
});

test('CSRF TIDAK memblokir login tanpa cookie (bug lama: 403 CSRF_INVALID)', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    // payload dummy — yang diuji: request sampai ke handler, bukan kredensialnya
    payload: { email: 'x@example.com', password: 'dummy-not-a-credential' },
  });
  assert.notEqual(res.statusCode, 403, `login tidak boleh 403, dapat ${res.statusCode}: ${res.body}`);
  const body = res.json();
  assert.notEqual(body?.error?.code, 'CSRF_INVALID');
  // Tanpa DB, handler tercapai lalu gagal di Prisma → 500 INTERNAL_ERROR.
  // Yang diuji: request SAMPAI ke handler ( CSRF skip bekerja ).
  assert.equal(res.statusCode, 500);
   // code diisi handler custom (bisa 'P1001' dari Prisma / 'INTERNAL_ERROR') —
  // yang penting bentuk {success, error:{code}} terbukti handler custom aktif.
   assert.ok(body?.success === false && typeof body?.error?.code === 'string' && body.error.code.length > 0,
     `body tidak pakai format error custom: ${res.body}`);
});

test('CSRF aktif untuk jalur cookie auth yang valid', async () => {
  const token = app.jwt.sign({ id: '11111111-1111-4111-8111-111111111111', roles: ['CITIZEN'], v: 0 });
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/public/authorities/nearby',
    cookies: { auth_token: token },
    payload: { latitude: -6.2, longitude: 106.8, limit: 1 },
  });
  assert.equal(res.statusCode, 403, `harus 403 CSRF, dapat ${res.statusCode}: ${res.body}`);
  assert.match(res.json()?.error?.code || '', /CSRF/);
});

test('tanpa token, /admin/* → 401 (bug lama: hook tanpa authenticate)', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/v1/admin/dashboard' });
  assert.equal(res.statusCode, 401);
});

test('WS broadcast report tanpa auth → 401 (bug lama: endpoint terbuka)', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/ws/broadcast/report',
    payload: { reportId: '11111111-1111-4111-8111-111111111111', update: { status: 'RESOLVED', message: 'ok' } },
  });
  assert.equal(res.statusCode, 401);
});

test('GET /auth/csrf-token tersedia', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/v1/auth/csrf-token' });
  assert.equal(res.statusCode, 200);
  assert.ok(res.json()?.data?.csrf_token);
});

test('/documentation (swagger) tersedia', async () => {
  const res = await app.inject({ method: 'GET', url: '/documentation/json' });
  assert.equal(res.statusCode, 200);
  const spec = res.json();
  assert.ok(spec?.paths && Object.keys(spec.paths).length > 0, 'openapi spec harus punya paths');
});
