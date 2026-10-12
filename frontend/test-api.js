const axios = require('axios');

(async () => {
  const results = [];
  const test = (name, fn) => fn().then(r => results.push([name, r])).catch(e => results.push([name, `ERROR: ${e.response?.status} ${e.response?.data?.error?.message || e.message}`]));

  // 1. Login
  let token;
  await test('1. Login', async () => {
    const res = await axios.post('http://localhost:3003/api/v1/auth/login', { email: 'test@laporjalan.id', password: 'password123' });
    token = res.data.data.token;
    return res.data.success ? 'PASS' : 'FAIL';
  });

  // 2. Create report
  await test('2. Create report', async () => {
    const res = await axios.post('http://localhost:3003/api/v1/reports', {
      title: 'Lubang di Jalan Sudirman',
      description: 'Lubang besar sekitar 40cm di Jalan Sudirman dekat Mall Plaza',
      damageType: 'POTHOLE',
      severity: 'HIGH',
      latitude: -6.1944,
      longitude: 106.8229,
      address: 'Jl. Sudirman No. 10, Jakarta Selatan',
      images: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==']
    }, { headers: { Authorization: 'Bearer ' + token } });
    return res.data.success ? `PASS (${res.data.data?.report?.trackingCode})` : `FAIL: ${res.data?.error?.message}`;
  });

  // 3. My reports
  await test('3. My reports', async () => {
    const res = await axios.get('http://localhost:3003/api/v1/reports/my', { headers: { Authorization: 'Bearer ' + token } });
    return res.data.success ? `PASS (${res.data.data?.reports?.length || 0} reports)` : `FAIL: ${res.data?.error?.message}`;
  });

  // 4. Chat
  await test('4. Chat session + message', async () => {
    const session = await axios.post('http://localhost:3003/api/v1/chat/sessions', { title: 'Test' }, { headers: { Authorization: 'Bearer ' + token } });
    const sessionId = session.data.data.session.id;
    const msg = await axios.post('http://localhost:3003/api/v1/chat/sessions/' + sessionId + '/messages', { message: 'Ada lubang di jalan' }, { headers: { Authorization: 'Bearer ' + token } });
    return msg.data.success ? `PASS (${msg.data.data?.message?.substring(0, 60)}...)` : `FAIL: ${msg.data?.error?.message}`;
  });

  // 5. Health
  await test('5. Health', async () => {
    const res = await axios.get('http://localhost:3003/api/v1/public/health');
    return res.data.status === 'ok' ? 'PASS' : 'FAIL';
  });

  // 6. Info
  await test('6. Info', async () => {
    const res = await axios.get('http://localhost:3003/api/v1/public/info');
    return res.data.name ? 'PASS' : 'FAIL';
  });

  // 7. CSRF
  await test('7. CSRF token', async () => {
    const res = await axios.get('http://localhost:3003/api/v1/auth/csrf-token');
    return res.data.success ? 'PASS' : 'FAIL';
  });

  // 8. Nearby
  await test('8. Nearby authorities', async () => {
    const res = await axios.post('http://localhost:3003/api/v1/public/authorities/nearby', { latitude: -6.1944, longitude: 106.8229, damageType: 'POTHOLE' });
    return res.data.success ? `PASS (${res.data.data?.authorities?.length || 0} results)` : `FAIL: ${res.data?.error?.message}`;
  });

  // 9. Analyze image
  await test('9. Analyze image', async () => {
    const res = await axios.post('http://localhost:3003/api/v1/reports/analyze-image', {
      image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      latitude: -6.1944,
      longitude: 106.8229
    }, { headers: { Authorization: 'Bearer ' + token } });
    return res.data.success ? `PASS (${res.data.data?.analysis?.damageType})` : `FAIL: ${res.data?.error?.message}`;
  });

  // 10. Boundary
  await test('10. Boundary', async () => {
    const res = await axios.post('http://localhost:3003/api/v1/authorities/boundary', { latitude: -6.1944, longitude: 106.8229 }, { headers: { Authorization: 'Bearer ' + token } });
    return res.data.success ? 'PASS' : `FAIL: ${res.data?.error?.message}`;
  });

  // 11. Reports authorities nearby
  await test('11. Reports authorities nearby', async () => {
    const res = await axios.post('http://localhost:3003/api/v1/reports/authorities/nearby', { latitude: -6.1944, longitude: 106.8229, damageType: 'POTHOLE' }, { headers: { Authorization: 'Bearer ' + token } });
    return res.data.success ? `PASS (${res.data.data?.authorities?.length || 0})` : `FAIL: ${res.data?.error?.message}`;
  });

  // 12. Knowledge search
  await test('12. Knowledge search', async () => {
    const res = await axios.get('http://localhost:3003/api/v1/public/knowledge/search?q=lubang');
    return res.data.success ? `PASS (${res.data.data?.results?.length || 0})` : `FAIL: ${res.data?.error?.message}`;
  });

  console.log('\n=== RUNTIME TEST RESULTS ===');
  for (const [name, result] of results) {
    console.log(`${name}: ${result}`);
  }
  const passed = results.filter(([, r]) => r.startsWith('PASS')).length;
  console.log(`\n${passed}/${results.length} passed`);
})();
