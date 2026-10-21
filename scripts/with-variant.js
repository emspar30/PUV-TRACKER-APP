// DR1: run a command as one app variant, the same way in PowerShell and bash (no dependencies).
//   node scripts/with-variant.js driver -- npx expo start --dev-client --port 8082
//   node scripts/with-variant.js gateway -- npx expo prebuild --clean --platform android
// Sets APP_VARIANT for the command, which app.config.js reads.

const { spawnSync } = require('node:child_process');

const VARIANTS = ['commuter', 'driver', 'gateway'];
const [variant, separator, command, ...args] = process.argv.slice(2);

if (!VARIANTS.includes(variant) || separator !== '--' || !command) {
  console.error(`Usage: node scripts/with-variant.js <${VARIANTS.join('|')}> -- <command> [args...]`);
  process.exit(2);
}

const result = spawnSync(command, args, {
  stdio: 'inherit',
  env: { ...process.env, APP_VARIANT: variant },
  // npx is npx.cmd on Windows, which only a shell can start
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
