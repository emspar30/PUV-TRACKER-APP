// Runs live tests (tests/integration) against the live Supabase project, one file at a time, the same
// way in PowerShell and bash (no dependencies):
//   npm run test:live -- tests/integration/driverRegistration.test.ts
// Each file must be named: `npx jest` alone never runs them (jest.config.js), because driverSide.test.ts
// queues texts the real gateway could pick up, and two files share the admin PIN setting and the test
// account's admin row, so they must not run side by side.

const { run } = require('jest');

const files = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
if (files.length === 0 || !files.every((file) => file.replace(/\\/g, '/').includes('tests/integration/'))) {
  console.error('Usage: npm run test:live -- tests/integration/<file>.test.ts [more files]');
  process.exit(2);
}

process.env.TUNTON_LIVE = '1';
run(['--runInBand', ...process.argv.slice(2)]);
