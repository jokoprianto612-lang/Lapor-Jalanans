require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const { randomBytes, pbkdf2Sync } = require('crypto');

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

const p = new PrismaClient();

(async () => {
  const admin = await p.user.upsert({
    where: { email: 'admin@laporjalan.id' },
    update: {},
    create: {
      email: 'admin@laporjalan.id',
      name: 'Admin',
      passwordHash: hashPassword('admin12345'),
      role: 'ADMIN'
    }
  });
  console.log('Admin user created:', admin.email, '-', admin.role);
  await p.$disconnect();
})();
