import { PrismaClient } from '@prisma/client';

async function test(name, url) {
  const p = new PrismaClient({ datasources: { db: { url } } });
  try {
    const t0 = Date.now();
    await p.$queryRaw`SELECT 1`;
    console.log(`[PASS] ${name} connected in ${Date.now() - t0}ms`);
    return true;
  } catch (err) {
    console.log(`[FAIL] ${name}: ${err.message.split('\n')[0]}`);
    return false;
  } finally {
    await p.$disconnect();
  }
}

async function run() {
  const current = "postgresql://neondb_owner:npg_qgHnM7vLkT5i@ep-hidden-star-b5qnnnle.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
  const withTimeout = "postgresql://neondb_owner:npg_qgHnM7vLkT5i@ep-hidden-star-b5qnnnle.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&connect_timeout=30";
  const pooler = "postgresql://neondb_owner:npg_qgHnM7vLkT5i@ep-hidden-star-b5qnnnle-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&connect_timeout=30";

  await test('current without timeout', current);
  await test('direct with 30s timeout', withTimeout);
  await test('pooler with 30s timeout', pooler);
}

run();
