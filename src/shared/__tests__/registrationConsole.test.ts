import { REGISTRATION_REASON_MAX_CHARS } from '../config';
import { localPhDigits, normalizePhNumber } from '../driver/phone';
import { localPhNumber, photosLeft, rejectionReason, splitRegistrations, type ConsoleRegistration } from '../driver/registrationConsole';

// DRG5: the admin console's rules (src/shared/driver/registrationConsole.ts)

function row(id: string, status: ConsoleRegistration['status'], createdAt: string, photos: [string | null, string | null] = [null, null]): ConsoleRegistration {
  return {
    registration_id: id,
    status,
    phone_e164: '+639171234567',
    plate: 'ABC 1234',
    route_id: 'R4',
    vehicle_id: 'R4-ABC1234',
    reason: null,
    id_photo_path: photos[0],
    vehicle_photo_path: photos[1],
    created_at: createdAt,
    decided_at: null,
    active_device: null,
  };
}

describe('splitRegistrations', () => {
  it('puts the waiting ones oldest first and keeps the rest in the order given', () => {
    const rows = [
      row('new', 'pending', '2026-10-28T03:00:00.000Z'),
      row('old', 'pending', '2026-10-27T09:00:00.000Z'),
      row('done', 'collected', '2026-10-28T02:00:00.000Z'),
      row('no', 'rejected', '2026-10-26T02:00:00.000Z'),
    ];
    const { waiting, decided } = splitRegistrations(rows);
    expect(waiting.map((r) => r.registration_id)).toEqual(['old', 'new']);
    expect(decided.map((r) => r.registration_id)).toEqual(['done', 'no']);
  });

  it('handles an empty list', () => {
    expect(splitRegistrations([])).toEqual({ waiting: [], decided: [] });
  });
});

describe('photosLeft', () => {
  it('lists the photos of registrations that are no longer waiting', () => {
    const rows = [
      row('waiting', 'pending', '2026-10-28T00:00:00.000Z', ['w/id.jpg', 'w/vehicle.jpg']),
      row('approved', 'approved', '2026-10-28T00:00:00.000Z', ['a/id.jpg', 'a/vehicle.jpg']),
      row('half', 'rejected', '2026-10-28T00:00:00.000Z', [null, 'h/vehicle.jpg']),
      row('clean', 'expired', '2026-10-28T00:00:00.000Z'),
    ];
    expect(photosLeft(rows)).toEqual([
      { registrationId: 'approved', paths: ['a/id.jpg', 'a/vehicle.jpg'] },
      { registrationId: 'half', paths: ['h/vehicle.jpg'] },
    ]);
  });

  it('never lists a registration that is still waiting', () => {
    expect(photosLeft([row('w', 'pending', '2026-10-28T00:00:00.000Z', ['w/id.jpg', 'w/vehicle.jpg'])])).toEqual([]);
  });
});

describe('rejectionReason', () => {
  it('trims the reason and joins its spaces', () => {
    expect(rejectionReason('  The ID photo\n is not readable.  ')).toBe('The ID photo is not readable.');
  });

  it('refuses an empty reason', () => {
    expect(rejectionReason('   ')).toBeNull();
  });

  it('takes a reason up to the length the database keeps, and no longer', () => {
    expect(rejectionReason('x'.repeat(REGISTRATION_REASON_MAX_CHARS))).toHaveLength(REGISTRATION_REASON_MAX_CHARS);
    expect(rejectionReason('x'.repeat(REGISTRATION_REASON_MAX_CHARS + 1))).toBeNull();
  });
});

describe('localPhNumber', () => {
  it('writes a Philippine mobile number the local way', () => {
    expect(localPhNumber('+639171234567')).toBe('0917 123 4567');
  });

  it('leaves anything else as given', () => {
    expect(localPhNumber('+12025550123')).toBe('+12025550123');
    expect(localPhNumber('')).toBe('');
  });
});

describe('localPhDigits', () => {
  it('gives the saved number back as the driver typed it, starting 09', () => {
    expect(localPhDigits('+639951546412')).toBe('09951546412');
    expect(normalizePhNumber(localPhDigits('+639951546412'))).toBe('+639951546412');
  });

  it('leaves anything else (or nothing saved) as given', () => {
    expect(localPhDigits('')).toBe('');
    expect(localPhDigits('0917')).toBe('0917');
  });
});
