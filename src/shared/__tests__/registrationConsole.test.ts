import { REGISTRATION_REASON_MAX_CHARS } from '../config';
import { localPhDigits, normalizePhNumber } from '../driver/phone';
import {
  driverRoutes,
  filterDrivers,
  inTab,
  localPhNumber,
  photosLeft,
  REGISTRATION_TABS,
  rejectionReason,
  rowsInTab,
  splitRegistrations,
  tabCounts,
  type ConsoleDriver,
  type ConsoleRegistration,
} from '../driver/registrationConsole';

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

describe('the Registrations tabs', () => {
  const rows = [
    row('w', 'pending', '2026-10-28T03:00:00.000Z'),
    { ...row('a', 'approved', '2026-10-26T03:00:00.000Z'), decided_at: '2026-10-26T05:00:00.000Z' },
    { ...row('c', 'collected', '2026-10-27T03:00:00.000Z'), decided_at: '2026-10-27T05:00:00.000Z' },
    { ...row('r', 'rejected', '2026-10-25T03:00:00.000Z'), decided_at: '2026-10-25T04:00:00.000Z' },
    row('e', 'expired', '2026-10-20T03:00:00.000Z'),
  ];

  it('puts approved and set up together, and expired only under All', () => {
    expect(tabCounts(rows)).toEqual({ pending: 1, approved: 2, rejected: 1, all: 5 });
    expect(REGISTRATION_TABS.filter((tab) => inTab({ status: 'expired' }, tab))).toEqual(['all']);
  });

  it('lists a tab newest decision first, a waiting one by when it was sent', () => {
    expect(rowsInTab(rows, 'approved').map((r) => r.registration_id)).toEqual(['c', 'a']);
    expect(rowsInTab(rows, 'all').map((r) => r.registration_id)).toEqual(['w', 'c', 'a', 'r', 'e']);
  });
});

describe('the Drivers filters', () => {
  const phone = (device: string, plate: string, route: string, provisionedAt: string): ConsoleDriver => ({
    device_id: device,
    vehicle_id: `${route}-${plate.replace(' ', '')}`,
    plate,
    route_id: route,
    phone_e164: '+639171234567',
    provisioned_at: provisionedAt,
  });
  const phones = [
    phone('DRV-0001', 'TEST 001', 'R4', '2026-10-20T00:00:00.000Z'),
    phone('DRV-0002', 'ABC 1234', 'R14', '2026-10-27T00:00:00.000Z'),
    phone('DRV-0003', 'TST 0099', 'R2', '2026-10-28T00:00:00.000Z'),
    phone('DRV-0004', 'XYZ 5678', 'R4', '2026-10-25T00:00:00.000Z'),
  ];

  it('lists the newest set up first', () => {
    expect(filterDrivers(phones, null, '').map((d) => d.device_id)).toEqual(['DRV-0003', 'DRV-0002', 'DRV-0004', 'DRV-0001']);
  });

  it('keeps one route', () => {
    expect(filterDrivers(phones, 'R4', '').map((d) => d.device_id)).toEqual(['DRV-0004', 'DRV-0001']);
  });

  it('finds a plate whatever its spaces and case', () => {
    expect(filterDrivers(phones, null, 'test0').map((d) => d.device_id)).toEqual(['DRV-0001']);
    expect(filterDrivers(phones, null, ' t ').map((d) => d.device_id)).toEqual(['DRV-0003', 'DRV-0001']);
    expect(filterDrivers(phones, 'R14', 'test')).toEqual([]);
  });

  it('offers the routes on the list in route order', () => {
    expect(driverRoutes(phones)).toEqual(['R2', 'R4', 'R14']);
  });
});
