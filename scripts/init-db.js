const { execSync } = require('child_process');
const path = require('path');

console.log('--- PolyRAG Database Initialization ---');

const dbUrl = process.env.DATABASE_URL || '';
const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');

if (!isPostgres) {
  console.log('PostgreSQL DATABASE_URL not configured or not a valid postgres connection string.');
  console.log('Skipping automatic database push & seeding.');
  console.log('Once your Neon database connection string is set in .env or Vercel, run:');
  console.log('  npx prisma db push && npm run seed\n');
} else {
  try {
    console.log('Running prisma db push against PostgreSQL...');
    execSync('npx prisma db push --skip-generate', {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
      env: process.env,
    });

    console.log('Running database seeding...');
    require('./seed.js');

    console.log('Database initialization complete.');
  } catch (error) {
    console.error('Database initialization encountered an error:', error.message);
  }
}

