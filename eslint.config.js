const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// What the driver and gateway apps may not import (DR1)
const OFF_LIMITS_FOR_DRIVER_SIDE = [
  '@supabase/*',
  '@/services/*',
  '@/data/live/*',
  '@/state/sessionStore',
  '@/app/*',
  '@/features/*',
  '@/components/TopBar',
  '@/components/AvatarButton',
];

module.exports = defineConfig([
  expoConfig,
  {
    // The Edge Function entry files run in Deno, with imports ESLint and TypeScript here cannot resolve
    ignores: ['dist/*', 'android/*', 'docs/*', '.expo/*', 'supabase/functions/*/index.ts', 'supabase/.temp/*'],
  },
  {
    // Pure TypeScript only: these folders must run in plain Node (PRD 0.1 rule 5)
    files: [
      'src/shared/**/*.ts',
      'src/data/seed/**/*.ts',
      'src/data/map/**/*.ts',
      'src/data/routeSource.ts',
      'supabase/functions/_shared/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-native',
                'react-native/*',
                'react-native-*',
                'expo',
                'expo/*',
                'expo-*',
                '@expo/*',
                '@maplibre/*',
                '@/app/*',
                '@/driver/*',
                '@/gateway/*',
              ],
              message: 'Shared code must not import React, React Native, Expo or app screens.',
            },
          ],
        },
      ],
    },
  },
  ...[
    ['src/driver/**/*.{ts,tsx}', '@/gateway/*', 'The driver app never reaches the cloud, the commuter app or the gateway app (PRD 6.2).'],
    ['src/gateway/**/*.{ts,tsx}', '@/driver/*', 'The gateway app talks only to the SMS worker: never Supabase, the commuter or the driver app.'],
  ].map(([files, otherApp, message]) => ({
    // DR1: the driver and gateway apps never reach the cloud (PRD 6.2: the driver channel is one-way;
    // the gateway talks only to the SMS worker) or another app. The components barrel is out too: it
    // pulls in the top bar, and with it the session and Supabase. variantBoundaries.test.ts checks the
    // whole import graph; this catches the direct imports while typing.
    files: [files],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: '@/components', message: 'Import the one component by its file, e.g. @/components/Screen.' }],
          patterns: [{ group: [...OFF_LIMITS_FOR_DRIVER_SIDE, otherApp], message }],
        },
      ],
    },
  })),
  {
    // DR1: the commuter app never imports the driver or gateway app
    files: ['src/app/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}', 'src/state/**/*.ts', 'src/components/**/*.tsx', 'src/services/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [{ group: ['@/driver/*', '@/gateway/*'], message: 'The commuter app never imports the driver or gateway app.' }],
        },
      ],
    },
  },
  {
    // Every threshold lives in src/shared/config (PRD 0.1 rule 3)
    files: ['src/shared/**/*.ts'],
    ignores: ['src/shared/config/**', 'src/shared/**/__tests__/**'],
    rules: {
      'no-magic-numbers': ['error', { ignore: [0, 1], ignoreArrayIndexes: true, enforceConst: true }],
    },
  },
]);
