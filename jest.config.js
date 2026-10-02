const expoPreset = require('jest-expo/jest-preset');

// Pure logic runs in plain Node with no React Native setup, so it stays extractable (PRD 0.1 rule 5).
const shared = {
  displayName: 'shared',
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/shared/**/__tests__/**/*.test.ts',
    '<rootDir>/supabase/functions/_shared/**/*.test.ts',
    '<rootDir>/tests/integration/**/*.test.ts',
  ],
  transform: expoPreset.transform,
  // @noble/hashes ships ES modules only, and so does the module Expo's Babel preset
  // substitutes for process.env
  transformIgnorePatterns: ['/node_modules/(?!(@noble|expo/virtual)/)'],
};

const app = {
  displayName: 'app',
  rootDir: __dirname,
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/shared/'],
};

module.exports = { projects: [shared, app] };
