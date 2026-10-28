// The rules of the two driver registration Edge Functions (DRG3; PRD 9.5,
// docs/IMPLEMENTATION_PLAN_DRIVER_REGISTRATION.md), with every database, storage and random call
// passed in. Pure TypeScript: the functions wire it to Supabase, and unit tests wire it to fakes.
//
// They are served by one Edge Function, driver-registration (handleDriverRegistration). The driver
// app calls it without an account (it has none), with a JSON body { action, ... }:
//   registering  start  { phone }                        the check id and two photo upload links
//                submit { check, plate, route }          a pending registration, and its install token
//   setup        status  { token }                       pending, approved, rejected (reason), ...
//                collect { token }                       the setup, once (the QR's payload)
// The install token is made here at submission and returned once, to the submitting phone only (the
// app has no secure random source of its own); the server keeps only its SHA-256. The database functions
// (20261027000000_driver_registration.sql) enforce the limits; a refusal comes back as its reason.
//
// The number is taken as typed: no SMS checks it (owner decision, 2026-10-28). "start" still goes
// through the database's number check, with a code it confirms at once and a text that expires before
// the gateway could send it, so the check row keeps carrying the photo folder, the daily limits and
// the hour within which the registration must be submitted.

import { normalizePhNumber } from './phone.ts';
import { checkText, isInstallToken, isRouteCode, normalizePlate } from './registrationRules.ts';
import {
  PROVISIONING_QR_TTL_MIN,
  REGISTRATION_CHECK_MAX_TRIES,
  REGISTRATION_CHECK_TTL_MIN,
  REGISTRATION_CHECKS_PER_DAY,
  REGISTRATION_CHECKS_PER_NUMBER_PER_DAY,
  REGISTRATION_SETUP_TTL_DAYS,
  REGISTRATION_SUBMIT_WITHIN_MIN,
} from './serverConfig.ts';

const MS_PER_S = 1000;
const S_PER_MIN = 60;
// No wait between two starts for the same number, and no text: nothing is sent
const NO_RESEND_WAIT_MIN = 0;
const NO_SMS_TTL_MIN = 0;
const BODY_MAX_BYTES = 4096;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_METHOD_NOT_ALLOWED = 405;
const HTTP_CONFLICT = 409;
const HTTP_TOO_LARGE = 413;
const HTTP_TOO_MANY = 429;

export type SmsEncoding = 'data' | 'text';

export type CheckStartArgs = {
  phone: string;
  code: string;
  encoding: SmsEncoding;
  bodyText: string;
  bodyB64: string | null;
  ttlMin: number;
  smsTtlMin: number;
  resendMin: number;
  perNumber: number;
  perDay: number;
};

export type SubmitArgs = { check: string; plate: string; route: string; tokenHash: string; withinMin: number };

// What registration_collect returns (the database's names)
export type CollectedSetup = {
  device_id: string;
  vehicle_id: string;
  short_id: number;
  route_id: string;
  plate: string;
  gateway_numbers: string[];
  beacon_secret: string;
  sms_key: string;
  admin_pin_hash: string;
  admin_pin_salt: string;
};

// The setup the app receives: exactly the driver QR's payload (src/shared/driver/provisioning.ts),
// which the app encodes and parses as if a QR had been scanned
export type DriverSetupPayload = {
  v: 1;
  kind: 'driver';
  exp: number;
  adminPinHash: string;
  adminPinSalt: string;
  deviceId: string;
  vehicleId: string;
  shortId: number;
  routeCode: string;
  plate: string;
  beaconSecret: string;
  smsKey: string;
  gatewayNumbers: string[];
};

// Every call may throw an Error whose message is the database's refusal reason (too_soon,
// check_not_verified, not_approved, ...); any other error is a server error.
export type RegistrationDeps = {
  nowMs(): number;
  // Six random digits
  newCode(): string;
  // 32 random bytes as base64url (43 characters)
  newToken(): string;
  sha256Hex(text: string): Promise<string>;
  startCheck(args: CheckStartArgs): Promise<void>;
  // The check id on a match, or null
  verifyCheck(phone: string, code: string, maxTries: number): Promise<string | null>;
  // Short-lived upload links for the check's two photos
  uploadLinks(check: string): Promise<{ id: string; vehicle: string }>;
  submit(args: SubmitArgs): Promise<void>;
  // null when no registration has this token
  status(tokenHash: string, ttlDays: number): Promise<{ status: string; reason: string | null } | null>;
  // Whether an active gateway has a number (a setup without one could not be used)
  hasGatewayNumber(): Promise<boolean>;
  // null when the approval had expired
  collect(tokenHash: string, ttlDays: number): Promise<CollectedSetup | null>;
};

export type RegistrationRequest = { method: string; body: string };
export type RegistrationResponse = { status: number; body: Record<string, unknown> };

const refused = (status: number, error: string): RegistrationResponse => ({ status, body: { ok: false, error } });
const ok = (body: Record<string, unknown> = {}): RegistrationResponse => ({ status: HTTP_OK, body: { ok: true, ...body } });

// Runs a database call and turns a known refusal into its response; anything else is rethrown
async function attempt<T>(call: () => Promise<T>, refusals: Record<string, RegistrationResponse>): Promise<T | RegistrationResponse> {
  try {
    return await call();
  } catch (error) {
    const reason = error instanceof Error ? error.message : '';
    if (reason in refusals) return refusals[reason];
    throw error;
  }
}

const isResponse = (value: unknown): value is RegistrationResponse =>
  typeof value === 'object' && value !== null && 'status' in value && 'body' in value;

function readBody(request: RegistrationRequest): Record<string, unknown> | RegistrationResponse {
  if (request.method !== 'POST') return refused(HTTP_METHOD_NOT_ALLOWED, 'method_not_allowed');
  if (request.body.length > BODY_MAX_BYTES) return refused(HTTP_TOO_LARGE, 'too_large');
  try {
    const parsed: unknown = JSON.parse(request.body);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return refused(HTTP_BAD_REQUEST, 'malformed');
    return parsed as Record<string, unknown>;
  } catch {
    return refused(HTTP_BAD_REQUEST, 'malformed');
  }
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

// --- driver-register

// Records the typed number (see the top of this file: no SMS) and returns the check id with its two
// photo upload links. The daily limits still apply: per number and in total, they bound how often the
// photo bucket can be written to.
async function start(body: Record<string, unknown>, deps: RegistrationDeps): Promise<RegistrationResponse> {
  const phone = normalizePhNumber(text(body.phone));
  if (!phone) return refused(HTTP_BAD_REQUEST, 'invalid_number');
  const code = deps.newCode();
  const result = await attempt(
    () =>
      deps.startCheck({
        phone,
        code,
        encoding: 'text',
        bodyText: checkText(code),
        bodyB64: null,
        ttlMin: REGISTRATION_CHECK_TTL_MIN,
        smsTtlMin: NO_SMS_TTL_MIN,
        resendMin: NO_RESEND_WAIT_MIN,
        perNumber: REGISTRATION_CHECKS_PER_NUMBER_PER_DAY,
        perDay: REGISTRATION_CHECKS_PER_DAY,
      }),
    {
      number_limit: refused(HTTP_TOO_MANY, 'number_limit'),
      daily_limit: refused(HTTP_TOO_MANY, 'daily_limit'),
      invalid_number: refused(HTTP_BAD_REQUEST, 'invalid_number'),
    },
  );
  if (isResponse(result)) return result;
  const check = await deps.verifyCheck(phone, code, REGISTRATION_CHECK_MAX_TRIES);
  if (!check) throw new Error('the new number check did not confirm');
  const uploads = await deps.uploadLinks(check);
  return ok({ phone, check, uploads, submitWithinS: REGISTRATION_SUBMIT_WITHIN_MIN * S_PER_MIN });
}

async function submit(body: Record<string, unknown>, deps: RegistrationDeps): Promise<RegistrationResponse> {
  const check = text(body.check);
  if (!UUID_RE.test(check)) return refused(HTTP_BAD_REQUEST, 'check_not_verified');
  const plate = normalizePlate(text(body.plate));
  if (!plate) return refused(HTTP_BAD_REQUEST, 'invalid_plate');
  const route = text(body.route);
  if (!isRouteCode(route)) return refused(HTTP_BAD_REQUEST, 'invalid_route');
  const token = deps.newToken();
  if (!isInstallToken(token)) throw new Error('the install token is malformed');
  const tokenHash = await deps.sha256Hex(token);
  const result = await attempt(() => deps.submit({ check, plate, route, tokenHash, withinMin: REGISTRATION_SUBMIT_WITHIN_MIN }), {
    check_not_verified: refused(HTTP_BAD_REQUEST, 'check_not_verified'),
    photos_missing: refused(HTTP_BAD_REQUEST, 'photos_missing'),
    invalid_plate: refused(HTTP_BAD_REQUEST, 'invalid_plate'),
    invalid_route: refused(HTTP_BAD_REQUEST, 'invalid_route'),
  });
  if (isResponse(result)) return result;
  return ok({ plate, route, token });
}

export async function handleRegister(request: RegistrationRequest, deps: RegistrationDeps): Promise<RegistrationResponse> {
  const body = readBody(request);
  if (isResponse(body)) return body;
  switch (body.action) {
    case 'start':
      return start(body, deps);
    case 'submit':
      return submit(body, deps);
    default:
      return refused(HTTP_BAD_REQUEST, 'unknown_action');
  }
}

// --- driver-setup

async function tokenHashOf(body: Record<string, unknown>, deps: RegistrationDeps): Promise<string | null> {
  const token = text(body.token);
  return isInstallToken(token) ? deps.sha256Hex(token) : null;
}

export function setupPayload(setup: CollectedSetup, nowMs: number): DriverSetupPayload {
  return {
    v: 1,
    kind: 'driver',
    exp: Math.floor(nowMs / MS_PER_S) + PROVISIONING_QR_TTL_MIN * S_PER_MIN,
    adminPinHash: setup.admin_pin_hash,
    adminPinSalt: setup.admin_pin_salt,
    deviceId: setup.device_id,
    vehicleId: setup.vehicle_id,
    shortId: setup.short_id,
    routeCode: setup.route_id,
    plate: setup.plate,
    beaconSecret: setup.beacon_secret,
    smsKey: setup.sms_key,
    gatewayNumbers: setup.gateway_numbers,
  };
}

export async function handleSetup(request: RegistrationRequest, deps: RegistrationDeps): Promise<RegistrationResponse> {
  const body = readBody(request);
  if (isResponse(body)) return body;
  if (body.action !== 'status' && body.action !== 'collect') return refused(HTTP_BAD_REQUEST, 'unknown_action');
  const tokenHash = await tokenHashOf(body, deps);
  if (!tokenHash) return refused(HTTP_BAD_REQUEST, 'invalid_token');

  if (body.action === 'status') {
    const found = await deps.status(tokenHash, REGISTRATION_SETUP_TTL_DAYS);
    if (!found) return refused(HTTP_NOT_FOUND, 'unknown');
    return ok({ status: found.status, reason: found.reason });
  }

  // A setup without a gateway number would be refused by the app, so it is not made
  if (!(await deps.hasGatewayNumber())) return refused(HTTP_CONFLICT, 'not_ready');
  const result = await attempt(() => deps.collect(tokenHash, REGISTRATION_SETUP_TTL_DAYS), {
    not_approved: refused(HTTP_CONFLICT, 'not_approved'),
    pin_not_set: refused(HTTP_CONFLICT, 'not_ready'),
  });
  if (isResponse(result)) return result;
  if (!result) return refused(HTTP_CONFLICT, 'expired');
  return ok({ setup: setupPayload(result, deps.nowMs()) });
}

// --- The one Edge Function: the setup actions go to handleSetup, every other to handleRegister
export async function handleDriverRegistration(request: RegistrationRequest, deps: RegistrationDeps): Promise<RegistrationResponse> {
  const body = readBody(request);
  if (isResponse(body)) return body;
  return body.action === 'status' || body.action === 'collect' ? handleSetup(request, deps) : handleRegister(request, deps);
}
