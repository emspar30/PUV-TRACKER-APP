const expoPreset = require('jest-expo/jest-preset');

// The app imports its own files as @/..., as set in tsconfig.json
const moduleNameMapper = { '^@/(.*)$': '<rootDir>/src/$1' };

// The live tests (tests/integration) reach the live Supabase project, so they run only through
// `npm run test:live -- <file>` (scripts/test-live.js), which sets TUNTON_LIVE and runs one file at a
// time: driverSide.test.ts queues texts the real gateway could pick up, and two files share the admin
// PIN setting and the test account's admin row (a parallel run on 2026-10-28 broke one of them).
const LIVE = process.env.TUNTON_LIVE === '1';

// Pure logic runs in plain Node with no React Native setup, so it stays extractable (PRD 0.1 rule 5).
const shared = {
  displayName: 'shared',
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/shared/**/__tests__/**/*.test.ts',
    '<rootDir>/supabase/functions/_shared/**/*.test.ts',
    // DR6: the SMS worker (plain Node)
    '<rootDir>/services/sms-worker/__tests__/**/*.test.ts',
  ],
  transform: expoPreset.transform,
  // @noble/hashes ships ES modules only, and so does the module Expo's Babel preset
  // substitutes for process.env
  transformIgnorePatterns: ['/node_modules/(?!(@noble|expo/virtual)/)'],
  moduleNameMapper,
};

// Code that uses React Native or Expo modules (mocked by jest-expo)
const app = {
  displayName: 'app',
  rootDir: __dirname,
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/shared/'],
  // DR5: the driver app's tests check signed messages, so @noble/hashes (ES modules only) is
  // transformed here too, as in the shared project
  transformIgnorePatterns: expoPreset.transformIgnorePatterns.map((pattern) => pattern.replace('/node_modules/(?!(', '/node_modules/(?!(@noble|')),
  moduleNameMapper: { ...expoPreset.moduleNameMapper, ...moduleNameMapper },
};

const live = { ...shared, displayName: 'live', testMatch: ['<rootDir>/tests/integration/**/*.test.ts'] };

module.exports = LIVE ? { projects: [shared, app, live], maxWorkers: 1 } : { projects: [shared, app] };
