// Seed: buat user ADMIN pertama + data instansi default.
// Jalankan: ADMIN_EMAIL=... ADMIN_PASSWORD=... npx prisma db seed
// (Butuh DATABASE_URL yang valid — lihat .env)
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password.js';
import { seedAuthorities } from '../src/services/authority.js';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('ERROR: set ADMIN_EMAIL dan ADMIN_PASSWORD dulu, contoh:');
    console.error('  ADMIN_EMAIL=admin@laporjalan.id ADMIN_PASSWORD=rahasia123 npx prisma db seed');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('ERROR: ADMIN_PASSWORD minimal 8 karakter');
    process.exit(1);
  }

  // Ada jalur jadi ADMIN? Kalau belum ada, buat. Kalau ada, role dipastikan ADMIN
  // (password TIDAK di-reset supaya seed ulang tidak menghapus password yang sudah dipakai).
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== 'ADMIN') {
      await prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN' } });
      console.log(`User ${email} dipromosikan jadi ADMIN`);
    } else {
      console.log(`User ${email} sudah ADMIN (password tidak diubah)`);
    }
  } else {
    await prisma.user.create({
      data: { email, name: 'Administrator', role: 'ADMIN', passwordHash: hashPassword(password) },
    });
    console.log(`Admin dibuat: ${email}`);
  }

  await seedAuthorities();
  console.log('Seed selesai');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
