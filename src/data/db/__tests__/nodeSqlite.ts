// Test helper: an in-memory database from Node's built-in SQLite, exposing the same
// async methods the app uses from expo-sqlite. The SQL itself runs on real SQLite.

import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { MigrationDb } from '../migrate';
import type { RepositoryDb } from '../routeRepository';

export type TestDb = MigrationDb & RepositoryDb & { raw: DatabaseSync };

export function openTestDb(): TestDb {
  const raw = new DatabaseSync(':memory:');
  const params = (values: unknown[]) => values as SQLInputValue[];

  const db = {
    raw,
    execAsync: async (source: string) => {
      raw.exec(source);
    },
    runAsync: async (source: string, ...values: unknown[]) => {
      const result = raw.prepare(source).run(...params(values));
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    getFirstAsync: async (source: string, ...values: unknown[]) =>
      (raw.prepare(source).get(...params(values)) as unknown) ?? null,
    getAllAsync: async (source: string, ...values: unknown[]) => raw.prepare(source).all(...params(values)),
    withTransactionAsync: async (task: () => Promise<void>) => {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return db as unknown as TestDb;
}
