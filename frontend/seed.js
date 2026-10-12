// Seed authorities + admin user for Lapor Jalan
require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const auths = [
  { name: 'RT 001/RW 001 Menteng', type: 'RT', phone: '081234567001', whatsapp: '6281234567001', address: 'Jl. Menteng Raya No.1', latitude: -6.1944, longitude: 106.8229, radius: 1000 },
  { name: 'Kelurahan Menteng', type: 'KELURAHAN', phone: '0213905678', whatsapp: '6281234567100', address: 'Jl. Menteng Raya No.1', latitude: -6.1944, longitude: 106.8229, radius: 3000 },
  { name: 'Kecamatan Menteng', type: 'KECAMATAN', phone: '0213101234', whatsapp: '6281234567200', address: 'Jl. Menteng Raya No.1', latitude: -6.1944, longitude: 106.8229, radius: 5000 },
  { name: 'Dinas PU DKI', type: 'DINAS_PU', phone: '0211234567', whatsapp: '6281234567300', address: 'Jl. Medan Merdeka Selatan', latitude: -6.1754, longitude: 106.8272, radius: 50000 },
  { name: 'Dinas Bina Marga DKI', type: 'DINAS_BINA_MARGA', phone: '0211234568', whatsapp: '6281234567301', address: 'Jl. Medan Merdeka Selatan', latitude: -6.1754, longitude: 106.8272, radius: 50000 },
  { name: 'PLN Jakarta Pusat', type: 'PLN', phone: '123', whatsapp: '6281234567400', address: 'Jl. Trunojoyo No.1', latitude: -6.2189, longitude: 106.8192, radius: 20000 },
  { name: 'PDAM Jaya Jakarta Pusat', type: 'PDAM', phone: '0211500600', whatsapp: '6281234567401', address: 'Jl. Sudirman Kav.1', latitude: -6.2248, longitude: 106.8123, radius: 20000 },
  { name: 'BPBD DKI Jakarta', type: 'BPBD', phone: '117', whatsapp: '6281234567403', address: 'Jl. Medan Merdeka Selatan', latitude: -6.1754, longitude: 106.8272, radius: 50000 },
];

(async () => {
  let count = 0;
  for (const a of auths) {
    const id = 'auth-' + a.name.replace(/\s+/g, '-').toLowerCase();
    await p.authority.upsert({ where: { id }, update: a, create: { id, email: null, isActive: true, contactPerson: null, ...a } });
    count++;
  }
  console.log('Seeded', count, 'authorities');
  const total = await p.authority.count();
  console.log('Total authorities:', total);
  await p.$disconnect();
})();
