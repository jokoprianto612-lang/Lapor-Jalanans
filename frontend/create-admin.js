// Create/update an ADMIN user. Credentials come from env — never hardcoded.
//
// Usage:
//   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='<strong-password>' node create-admin.js
//
// Requires .env.local with DATABASE_URL.
require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const { randomBytes, pbkdf2Sync } = require('crypto');

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error('FATAL: ADMIN_EMAIL and ADMIN_PASSWORD env vars are required.');
  console.error("  e.g. ADMIN_EMAIL=admin@x.id ADMIN_PASSWORD='...' node create-admin.js");
  process.exit(1);
}
if (password.length < 12) {
  console.error('FATAL: ADMIN_PASSWORD must be at least 12 characters.');
  process.exit(1);
}

const p = new PrismaClient();

(async () => {
  const admin = await p.user.upsert({
    where: { email },
    update: { passwordHash: hashPassword(password), role: 'ADMIN', tokenVersion: { increment: 1 } },
    create: {
      email,
      name: 'Admin',
      passwordHash: hashPassword(password),
      role: 'ADMIN',
    },
  });
  console.log('Admin user upserted:', admin.email, '-', admin.role);
  await p.$disconnect();
})();
