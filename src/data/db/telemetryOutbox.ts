// T1: the store-and-forward buffer of a broadcasting phone, in the local table telemetry_buffer
// (schema.ts). Works against the small database interface, so tests run it on Node's SQLite.

import { OFFLINE_BUFFER_SIZE } from '../../shared/config';
import { parseOutboxPayload, type OutboxRow } from '../../shared/telemetry/outbox';
import type { TelemetryPacket } from '../../shared/telemetry/packet';

import type { Db } from './migrate';

// Adds a packet and keeps only the newest OFFLINE_BUFFER_SIZE (a long dead zone loses its oldest)
export async function pushOutbox(db: Db, packet: TelemetryPacket, nowMs: number): Promise<void> {
  await db.runAsync('INSERT INTO telemetry_buffer (payload, created_at) VALUES (?, ?)', [JSON.stringify(packet), nowMs]);
  await db.runAsync('DELETE FROM telemetry_buffer WHERE id NOT IN (SELECT id FROM telemetry_buffer ORDER BY id DESC LIMIT ?)', [
    OFFLINE_BUFFER_SIZE,
  ]);
}

// Every buffered packet, oldest first. A row that cannot be read is removed.
export async function readOutbox(db: Db): Promise<OutboxRow[]> {
  const rows = await db.getAllAsync<{ id: number; payload: string }>('SELECT id, payload FROM telemetry_buffer ORDER BY id', []);
  const read: OutboxRow[] = [];
  const broken: number[] = [];
  for (const row of rows) {
    const packet = parseOutboxPayload(row.payload);
    if (packet) read.push({ id: row.id, packet });
    else broken.push(row.id);
  }
  if (broken.length > 0) await removeOutbox(db, broken);
  return read;
}

export async function removeOutbox(db: Db, ids: readonly number[]): Promise<void> {
  if (ids.length === 0) return;
  await db.runAsync(`DELETE FROM telemetry_buffer WHERE id IN (${ids.map(() => '?').join(',')})`, [...ids]);
}

export async function countOutbox(db: Db): Promise<number> {
  return (await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM telemetry_buffer', []))?.n ?? 0;
}
