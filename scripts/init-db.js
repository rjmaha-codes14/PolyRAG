const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('--- PolyRAG Database Initialization ---');

try {
  // Ensure prisma db push is run
  console.log('Running prisma db push...');
  execSync('npx prisma db push --skip-generate', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db' }
  });

  // Run seed script
  console.log('Running database seeding...');
  require('./seed.js');

  console.log('Database initialization complete.');
} catch (error) {
  console.error('Database initialization encountered an error:', error.message);
  // Do not fail hard during postinstall if prisma CLI is bootstrapping
}
