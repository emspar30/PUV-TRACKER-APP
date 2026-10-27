// The driver registration Edge Functions' rules (DRG3), run against in-memory fakes. No Supabase
// project is involved: the database's own checks are tested live (tests/integration/driverRegistration.test.ts).

import { createHash } from 'node:crypto';

import {
  handleDriverRegistration,
  handleRegister,
  handleSetup,
  type CheckStartArgs,
  type CollectedSetup,
  type RegistrationDeps,
  type SubmitArgs,
} from '../../../supabase/functions/_shared/registrationCore';
import { CHECK_TEXT_PREFIX, decodeCheckData, readCheckCode } from '../driver/registration';
import { encodeProvisioning, parseProvisioning } from '../driver/provisioning';
import { HEATMAP_TEXT_PREFIX } from '../sms/protocol';

// Made-up test values only
const NOW = Date.UTC(2026, 9, 27, 2, 0);
const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456';
const TOKEN_HASH = createHash('sha256').update(TOKEN).digest('hex');
const CHECK = '0f8fad5b-d9cb-469f-a165-70867728950e';
const SETUP: CollectedSetup = {
  device_id: 'DRV-0011',
  vehicle_id: 'R4-ABC1234',
  short_id: 7,
  route_id: 'R4',
  plate: 'ABC 1234',
  gateway_numbers: ['+639171234567'],
  beacon_secret: '1'.repeat(64),
  sms_key: '2'.repeat(64),
  admin_pin_hash: '3'.repeat(64),
  admin_pin_salt: '4'.repeat(32),
};

type Fake = RegistrationDeps & { started: CheckStartArgs[]; submitted: SubmitArgs[] };

function fake(overrides: Partial<RegistrationDeps> = {}): Fake {
  const started: CheckStartArgs[] = [];
  const submitted: SubmitArgs[] = [];
  return {
    started,
    submitted,
    nowMs: () => NOW,
    encoding: 'data',
    newCode: () => '042917',
    newToken: () => TOKEN,
    sha256Hex: async (text) => createHash('sha256').update(text).digest('hex'),
    startCheck: async (args) => {
      started.push(args);
    },
    verifyCheck: async (_phone, code) => (code === '042917' ? CHECK : null),
    uploadLinks: async (check) => ({ id: `https://upload/${check}/id.jpg`, vehicle: `https://upload/${check}/vehicle.jpg` }),
    submit: async (args) => {
      submitted.push(args);
    },
    status: async (hash) => (hash === TOKEN_HASH ? { status: 'pending', reason: null } : null),
    hasGatewayNumber: async () => true,
    collect: async () => SETUP,
    ...overrides,
  };
}

const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });
const refusing = (reason: string) => async () => {
  throw new Error(reason);
};

describe('requests', () => {
  it('takes only a POST with a JSON object and a known action', async () => {
    expect((await handleRegister({ method: 'GET', body: '' }, fake())).status).toBe(405);
    expect(await handleRegister({ method: 'POST', body: 'nope' }, fake())).toEqual({ status: 400, body: { ok: false, error: 'malformed' } });
    expect((await handleRegister(post([1]), fake())).body.error).toBe('malformed');
    expect((await handleRegister(post({ action: 'collect' }), fake())).body.error).toBe('unknown_action');
    expect((await handleSetup(post({ action: 'start' }), fake())).body.error).toBe('unknown_action');
    expect((await handleRegister({ method: 'POST', body: 'x'.repeat(5000) }, fake())).status).toBe(413);
  });
});

describe('driver-register start', () => {
  it('queues a data check for the number in E.164, with the limits of D6', async () => {
    const deps = fake();
    const response = await handleRegister(post({ action: 'start', phone: '0917 123 4567' }), deps);
    expect(response).toEqual({ status: 200, body: { ok: true, phone: '+639171234567', codeValidS: 600, resendAfterS: 600 } });
    const [args] = deps.started;
    expect(args).toMatchObject({ phone: '+639171234567', code: '042917', encoding: 'data', bodyText: 'HM2|V|042917', ttlMin: 10, smsTtlMin: 10, resendMin: 10, perNumber: 3, perDay: 20 });
    expect(decodeCheckData(Uint8Array.from(Buffer.from(args.bodyB64!, 'base64')))).toBe('042917');
    expect(readCheckCode({ kind: 'data', body: Buffer.from(args.bodyB64!, 'base64').toString('hex') })).toBe('042917');
  });

  it('queues a text check when the gateway sends text, under the prefix the driver app already keeps', async () => {
    const deps = fake({ encoding: 'text' });
    await handleRegister(post({ action: 'start', phone: '+639171234567' }), deps);
    expect(deps.started[0]).toMatchObject({ encoding: 'text', bodyText: 'HM2|V|042917', bodyB64: null });
    expect(CHECK_TEXT_PREFIX.startsWith(HEATMAP_TEXT_PREFIX)).toBe(true);
  });

  it('never texts the live tests\' made-up numbers', async () => {
    const deps = fake();
    await handleRegister(post({ action: 'start', phone: '+639990001001' }), deps);
    expect(deps.started[0].smsTtlMin).toBe(0);
  });

  it('refuses a number that is not a Philippine mobile number, before anything is queued', async () => {
    const deps = fake();
    expect((await handleRegister(post({ action: 'start', phone: '12345' }), deps)).body.error).toBe('invalid_number');
    expect((await handleRegister(post({ action: 'start' }), deps)).body.error).toBe('invalid_number');
    expect(deps.started).toEqual([]);
  });

  it.each(['too_soon', 'number_limit', 'daily_limit'])('answers the database refusal %s with 429', async (reason) => {
    const response = await handleRegister(post({ action: 'start', phone: '09171234567' }), fake({ startCheck: refusing(reason) }));
    expect(response).toEqual({ status: 429, body: { ok: false, error: reason } });
  });

  it('lets any other database error through as a server error', async () => {
    await expect(handleRegister(post({ action: 'start', phone: '09171234567' }), fake({ startCheck: refusing('connection lost') }))).rejects.toThrow('connection lost');
  });
});

describe('driver-register verify and submit', () => {
  it('gives the check and the two upload links for the right code', async () => {
    const response = await handleRegister(post({ action: 'verify', phone: '09171234567', code: '042917' }), fake());
    expect(response).toEqual({
      status: 200,
      body: { ok: true, check: CHECK, uploads: { id: `https://upload/${CHECK}/id.jpg`, vehicle: `https://upload/${CHECK}/vehicle.jpg` }, submitWithinS: 3600 },
    });
  });

  it('refuses a wrong or malformed code the same way', async () => {
    expect((await handleRegister(post({ action: 'verify', phone: '09171234567', code: '000000' }), fake())).body.error).toBe('wrong_code');
    expect((await handleRegister(post({ action: 'verify', phone: '09171234567', code: '42' }), fake())).body.error).toBe('wrong_code');
  });

  it('submits the plate in its stored form and the route, stores only the hash of the token it makes, and returns the token once', async () => {
    const deps = fake();
    const response = await handleRegister(post({ action: 'submit', check: CHECK, plate: 'abc-1234', route: 'R4' }), deps);
    expect(response).toEqual({ status: 200, body: { ok: true, plate: 'ABC 1234', route: 'R4', token: TOKEN } });
    expect(deps.submitted).toEqual([{ check: CHECK, plate: 'ABC 1234', route: 'R4', tokenHash: TOKEN_HASH, withinMin: 60 }]);
    expect(JSON.stringify(deps.submitted)).not.toContain(TOKEN);
  });

  it.each([
    [{ check: 'not-a-uuid', plate: 'ABC 1234', route: 'R4' }, 'check_not_verified'],
    [{ check: CHECK, plate: 'AB', route: 'R4' }, 'invalid_plate'],
    [{ check: CHECK, plate: 'ABC 1234', route: '4' }, 'invalid_route'],
  ])('refuses %j with %s', async (fields, reason) => {
    const deps = fake();
    expect((await handleRegister(post({ action: 'submit', ...fields }), deps)).body.error).toBe(reason);
    expect(deps.submitted).toEqual([]);
  });

  it.each(['check_not_verified', 'photos_missing'])('answers the database refusal %s with 400', async (reason) => {
    const response = await handleRegister(post({ action: 'submit', check: CHECK, plate: 'ABC 1234', route: 'R4' }), fake({ submit: refusing(reason) }));
    expect(response).toEqual({ status: 400, body: { ok: false, error: reason } });
  });

  it('never hands out a malformed token', async () => {
    await expect(handleRegister(post({ action: 'submit', check: CHECK, plate: 'ABC 1234', route: 'R4' }), fake({ newToken: () => 'short' }))).rejects.toThrow('malformed');
  });
});

describe('driver-setup', () => {
  it('reports the status for the install token, or unknown', async () => {
    expect(await handleSetup(post({ action: 'status', token: TOKEN }), fake())).toEqual({ status: 200, body: { ok: true, status: 'pending', reason: null } });
    const other = 'Z'.repeat(43);
    expect((await handleSetup(post({ action: 'status', token: other }), fake())).status).toBe(404);
    expect((await handleSetup(post({ action: 'status', token: 'short' }), fake())).body.error).toBe('invalid_token');
  });

  it('collects the setup as the driver QR\'s payload, which the app\'s own parser accepts', async () => {
    const response = await handleSetup(post({ action: 'collect', token: TOKEN }), fake());
    expect(response.status).toBe(200);
    const setup = response.body.setup as Parameters<typeof encodeProvisioning>[0];
    expect(setup).toMatchObject({ v: 1, kind: 'driver', exp: NOW / 1000 + 15 * 60, deviceId: 'DRV-0011', vehicleId: 'R4-ABC1234', shortId: 7, routeCode: 'R4', plate: 'ABC 1234' });
    const parsed = parseProvisioning(encodeProvisioning(setup), 'driver', NOW);
    expect(parsed).toEqual({ ok: true, payload: setup });
  });

  it('collects with the token\'s hash only', async () => {
    const seen: string[] = [];
    await handleSetup(post({ action: 'collect', token: TOKEN }), fake({ collect: async (hash) => (seen.push(hash), SETUP) }));
    expect(seen).toEqual([TOKEN_HASH]);
  });

  it.each([
    [{ collect: refusing('not_approved') }, 'not_approved'],
    [{ collect: refusing('pin_not_set') }, 'not_ready'],
    [{ collect: async () => null }, 'expired'],
    [{ hasGatewayNumber: async () => false }, 'not_ready'],
  ])('refuses to collect with 409 when %#', async (overrides, reason) => {
    expect(await handleSetup(post({ action: 'collect', token: TOKEN }), fake(overrides as Partial<RegistrationDeps>))).toEqual({ status: 409, body: { ok: false, error: reason } });
  });

  it('makes no setup when no gateway has a number', async () => {
    let collected = false;
    await handleSetup(post({ action: 'collect', token: TOKEN }), fake({ hasGatewayNumber: async () => false, collect: async () => ((collected = true), SETUP) }));
    expect(collected).toBe(false);
  });
});

describe('driver-registration (the one Edge Function)', () => {
  it('sends status and collect to the setup rules and the rest to the registering rules', async () => {
    expect((await handleDriverRegistration(post({ action: 'status', token: TOKEN }), fake())).body).toEqual({ ok: true, status: 'pending', reason: null });
    expect((await handleDriverRegistration(post({ action: 'collect', token: TOKEN }), fake())).body.setup).toBeDefined();
    expect((await handleDriverRegistration(post({ action: 'start', phone: '09171234567' }), fake())).body.ok).toBe(true);
    expect((await handleDriverRegistration(post({ action: 'nothing' }), fake())).body.error).toBe('unknown_action');
    expect((await handleDriverRegistration({ method: 'PUT', body: '{}' }, fake())).status).toBe(405);
  });
});
