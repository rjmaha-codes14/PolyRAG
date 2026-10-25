import { PrismaClient } from '@prisma/client';

async function testDb(url) {
  const p = new PrismaClient({ datasources: { db: { url } } });
  try {
    const t0 = Date.now();
    await p.$queryRaw`SELECT 1`;
    console.log(`[PASS] Connected in ${Date.now() - t0}ms: ${url.slice(0, 45)}...`);
  } catch (err) {
    console.log(`[FAIL] ${url.slice(0, 45)}... -> ${err.message.split('\n')[0]}`);
  } finally {
    await p.$disconnect();
  }
}

const url1 = "postgresql://neondb_owner:npg_NByJTZoHm34e@ep-young-brook-b4amjsl9-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&connect_timeout=30&pool_timeout=30";
const url2 = "postgresql://neondb_owner:npg_qgHnM7vLkT5i@ep-hidden-star-b5qnnnle.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function run() {
  await testDb(url1);
  await testDb(url2);
}

run();
