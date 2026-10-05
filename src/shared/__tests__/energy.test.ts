// SB2: the Energy wallet behind the Demo switch. The demo ledger follows the server's rules; the live
// repository only maps the SB1 functions' answers. Fake ports and fixed clocks, no network.

import { createDemoEnergy } from '../../data/demo/demoEnergy';
import { createLiveEnergy, type EnergyPort } from '../../data/live/liveEnergy';
import { noLiveEnergy } from '../../data/repositories/noLiveData';
import { selectEnergy } from '../../data/repositories/select';
import { formatRefillIn, newRequestKey, nextPassiveRefillMs, usernameIssue } from '../backend/rules';
import {
  ENERGY_PASSIVE_AMOUNT,
  ENERGY_PASSIVE_INTERVAL_H,
  ENERGY_TRACKING_COST,
  ENERGY_WALLET_CAP,
  TRACKING_SESSION_MIN,
} from '../config';

const T0 = Date.UTC(2026, 9, 5, 2, 0, 0);
const HOUR = 3600000;
const MIN = 60000;

describe('the demo wallet', () => {
  it('starts with one refill, and books the next only after the interval', async () => {
    let now = T0;
    const energy = createDemoEnergy(() => now, false);
    expect(energy.source).toBe('demo');
    expect((await energy.refresh())?.balance).toBe(ENERGY_PASSIVE_AMOUNT);
    now += HOUR;
    expect((await energy.refresh())?.balance).toBe(ENERGY_PASSIVE_AMOUNT);
    now = T0 + ENERGY_PASSIVE_INTERVAL_H * HOUR;
    const snapshot = await energy.refresh();
    expect(snapshot?.balance).toBe(2 * ENERGY_PASSIVE_AMOUNT);
    expect(snapshot?.history.map((entry) => entry.atMs)).toEqual([now, T0]);
    expect(snapshot?.nextRefillMs).toBe(now + ENERGY_PASSIVE_INTERVAL_H * HOUR);
  });

  it('charges for tracking by default (Energy is on in demo), so a new wallet of 1 pays once', async () => {
    const energy = createDemoEnergy(() => T0);
    expect((await energy.refresh())?.balance).toBe(1);
    expect((await energy.startTracking('track-aaaaaaaa')).ok).toBe(true);
    const snapshot = await energy.refresh();
    expect(snapshot?.balance).toBe(0);
    expect(snapshot?.history[0]).toEqual({ kind: 'tracking', amount: -ENERGY_TRACKING_COST, atMs: T0 });
    expect(await energy.startTracking('track-bbbbbbbb')).toEqual({ ok: false, reason: 'not_enough_energy' });
  });

  it('tracking is free while Energy is off, and books nothing', async () => {
    const energy = createDemoEnergy(() => T0, false);
    await energy.refresh();
    expect(await energy.startTracking('track-aaaaaaaa')).toEqual({ ok: true, endsAtMs: T0 + TRACKING_SESSION_MIN * MIN });
    const snapshot = await energy.refresh();
    expect(snapshot?.enabled).toBe(false);
    expect(snapshot?.history.some((entry) => entry.kind === 'tracking')).toBe(false);
  });

  it('with Energy on, tracking spends once per request key and is refused when the wallet is short', async () => {
    const energy = createDemoEnergy(() => T0, true);
    await energy.refresh();
    expect((await energy.startTracking('track-aaaaaaaa')).ok).toBe(true);
    expect((await energy.startTracking('track-aaaaaaaa')).ok).toBe(true);
    expect((await energy.refresh())?.balance).toBe(ENERGY_PASSIVE_AMOUNT - ENERGY_TRACKING_COST);
    expect(await energy.startTracking('track-bbbbbbbb')).toEqual({ ok: false, reason: 'not_enough_energy' });
  });
});

const port = (over: Partial<EnergyPort> = {}): EnergyPort => ({
  signedIn: async () => true,
  refill: async () => null,
  read: async () => ({
    balance: '1.3',
    enabled: false,
    passiveIntervalH: ENERGY_PASSIVE_INTERVAL_H,
    lastPassiveAt: new Date(T0).toISOString(),
    rows: [{ kind: 'checkin', amount: '0.3', created_at: new Date(T0).toISOString() }],
  }),
  startTracking: async () => ({ endsAt: new Date(T0 + TRACKING_SESSION_MIN * MIN).toISOString() }),
  ...over,
});

describe('the live wallet', () => {
  it('signed out: no wallet, and tracking asks to sign in', async () => {
    const energy = createLiveEnergy(port({ signedIn: async () => false }));
    expect(await energy.refresh()).toBeNull();
    expect(await energy.startTracking('track-aaaaaaaa')).toEqual({ ok: false, reason: 'sign_in' });
  });

  it('refills, then reads numbers sent as text', async () => {
    const refill = jest.fn(async () => null);
    const energy = createLiveEnergy(port({ refill }), () => T0 + HOUR);
    expect(await energy.refresh()).toEqual({
      balance: 1.3,
      enabled: false,
      history: [{ kind: 'checkin', amount: 0.3, atMs: T0 }],
      nextRefillMs: T0 + ENERGY_PASSIVE_INTERVAL_H * HOUR,
    });
    expect(refill).toHaveBeenCalledTimes(1);
  });

  it('a failed refill still shows the balance', async () => {
    const energy = createLiveEnergy(port({ refill: async () => ({ code: null, message: 'offline' }) }));
    expect((await energy.refresh())?.balance).toBe(1.3);
  });

  it('maps the function errors', async () => {
    const failing = (code: string | null) => createLiveEnergy(port({ startTracking: async () => ({ code, message: 'm' }) }));
    expect(await failing('P0001').startTracking('k-aaaaaaaa')).toEqual({ ok: false, reason: 'not_enough_energy' });
    expect(await failing('28000').startTracking('k-aaaaaaaa')).toEqual({ ok: false, reason: 'sign_in' });
    expect(await failing('42501').startTracking('k-aaaaaaaa')).toEqual({ ok: false, reason: 'error', message: 'm' });
    const thrown = createLiveEnergy(port({ startTracking: async () => Promise.reject(new Error('network')) }));
    expect(await thrown.startTracking('k-aaaaaaaa')).toEqual({ ok: false, reason: 'error', message: 'network' });
  });

  it('a started session ends when the server says', async () => {
    expect(await createLiveEnergy(port()).startTracking('k-aaaaaaaa')).toEqual({ ok: true, endsAtMs: T0 + TRACKING_SESSION_MIN * MIN });
  });
});

describe('the Demo switch for Energy', () => {
  it('demo, live, or the stand-in with no wallet', async () => {
    const demo = createDemoEnergy(() => T0);
    const live = createLiveEnergy(port());
    expect(selectEnergy(true, demo, live)).toBe(demo);
    expect(selectEnergy(false, demo, live)).toBe(live);
    expect(selectEnergy(false, demo, null)).toBe(noLiveEnergy);
    expect(await noLiveEnergy.refresh()).toBeNull();
  });
});

describe('the refill countdown', () => {
  it('runs from the last refill, is due now without one, and stops while the wallet is full', () => {
    expect(nextPassiveRefillMs(T0, 1, T0 + HOUR)).toBe(T0 + ENERGY_PASSIVE_INTERVAL_H * HOUR);
    expect(nextPassiveRefillMs(null, 0, T0)).toBe(T0);
    expect(nextPassiveRefillMs(T0, ENERGY_WALLET_CAP, T0)).toBeNull();
    expect(nextPassiveRefillMs(T0, 1, T0, 6)).toBe(T0 + 6 * HOUR);
  });

  it('shows whole minutes, rounded up, and never 0', () => {
    expect(formatRefillIn(11 * HOUR + 59 * MIN)).toEqual({ hours: 11, minutes: 59 });
    expect(formatRefillIn(59 * MIN + 1)).toEqual({ hours: 1, minutes: 0 });
    expect(formatRefillIn(1)).toEqual({ hours: 0, minutes: 1 });
  });
});

describe('usernames and request keys', () => {
  it('blocks reserved names exactly and blocked words anywhere, in any case', () => {
    expect(usernameIssue('JuanCommuter')).toBeNull();
    expect(usernameIssue('Admin')).toBe('blocked');
    expect(usernameIssue('xxSHITxx')).toBe('blocked');
    expect(usernameIssue('ab')).toBe('format');
  });

  it('request keys fit energy_ledger (8 to 64 characters) and differ by time and chance', () => {
    const key = newRequestKey('track', T0, 0.5);
    expect(key.length).toBeGreaterThanOrEqual(8);
    expect(key.length).toBeLessThanOrEqual(64);
    expect(newRequestKey('track', T0, 0)).toMatch(/^track-[0-9a-z]+-0{8}$/);
    expect(newRequestKey('track', T0, 0.25)).not.toBe(key);
    expect(newRequestKey('track', T0 + 1, 0.5)).not.toBe(key);
  });
});
