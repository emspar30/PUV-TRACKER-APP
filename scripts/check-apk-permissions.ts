// DR1: check one app's Android permissions against scripts/variant-permissions.json.
//   npx tsx scripts/check-apk-permissions.ts driver path/to/app.apk
//   npx tsx scripts/check-apk-permissions.ts commuter android/app/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml
// An .apk is read with aapt2 from the Android SDK build-tools (ANDROID_HOME, or the default SDK
// folder); a merged AndroidManifest.xml, which every local Gradle build writes, needs nothing.
// Exits 1 on a forbidden, missing or unreviewed permission and prints which.

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { aaptPermissions, checkPermissions, manifestPermissions, type VariantPermissionRules } from '../src/shared/variants/permissions';

type RulesFile = Record<string, VariantPermissionRules & { package: string }>;

const [variant, input] = process.argv.slice(2);
const rulesFile: RulesFile = JSON.parse(fs.readFileSync(path.join(__dirname, 'variant-permissions.json'), 'utf8'));
const rules = rulesFile[variant];

if (!rules || variant.startsWith('_') || !input) {
  console.error('Usage: npx tsx scripts/check-apk-permissions.ts <commuter|driver|gateway> <app.apk | AndroidManifest.xml>');
  process.exit(2);
}
if (!fs.existsSync(input)) {
  console.error(`Not found: ${input}`);
  process.exit(2);
}

function findAapt2(): string {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk');
  const buildTools = path.join(sdk, 'build-tools');
  const versions = fs.existsSync(buildTools) ? fs.readdirSync(buildTools).sort() : [];
  const exe = process.platform === 'win32' ? 'aapt2.exe' : 'aapt2';
  for (const version of versions.reverse()) {
    const candidate = path.join(buildTools, version, exe);
    if (fs.existsSync(candidate)) return candidate;
  }
  console.error(`aapt2 not found under ${buildTools}. Install Android SDK build-tools, or pass the merged AndroidManifest.xml instead.`);
  process.exit(2);
}

const found = input.endsWith('.apk')
  ? aaptPermissions(execFileSync(findAapt2(), ['dump', 'permissions', input], { encoding: 'utf8' }))
  : manifestPermissions(fs.readFileSync(input, 'utf8'));

const result = checkPermissions(found, rules, rules.package);

console.log(`${variant}: ${found.length} permissions in ${path.basename(input)}`);
for (const name of [...found].sort()) console.log(`  ${name}`);
if (result.forbidden.length > 0) console.log(`FORBIDDEN (must be removed): ${result.forbidden.join(', ')}`);
if (result.missing.length > 0) console.log(`MISSING (required): ${result.missing.join(', ')}`);
if (result.unreviewed.length > 0) {
  console.log('UNREVIEWED (check each, then add it to "allowed" in scripts/variant-permissions.json):');
  for (const name of result.unreviewed) console.log(`  "${name}",`);
}
console.log(result.ok ? 'OK' : 'FAILED');
process.exit(result.ok ? 0 : 1);
