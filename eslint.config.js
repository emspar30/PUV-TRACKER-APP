const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'docs/*', '.expo/*'],
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
              group: ['react', 'react-native', 'react-native/*', 'react-native-*', 'expo', 'expo/*', 'expo-*', '@expo/*', '@maplibre/*', '@/app/*'],
              message: 'Shared code must not import React, React Native, Expo or app screens.',
            },
          ],
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
