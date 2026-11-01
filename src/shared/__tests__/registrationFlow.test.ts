import {
  checkFresh,
  mayCollect,
  mustRegisterAgain,
  photoTooBig,
  pickPictureSize,
  resumeStep,
  waitingStatus,
  type RegistrationProgress,
} from '../driver/registrationFlow';

// Made-up test values only
const NOW = Date.UTC(2026, 9, 27, 2, 0);
const MIN = 60000;
const EMPTY: RegistrationProgress = {
  phone: null,
  check: null,
  checkedAtMs: null,
  uploads: null,
  uploaded: { id: false, vehicle: false },
  plate: null,
  route: null,
  token: null,
};
const CHECKED: RegistrationProgress = {
  ...EMPTY,
  phone: '+639171234567',
  check: '0f8fad5b-d9cb-469f-a165-70867728950e',
  checkedAtMs: NOW - 5 * MIN,
  uploads: { id: 'https://upload/id.jpg', vehicle: 'https://upload/vehicle.jpg' },
};

describe('resuming after a restart', () => {
  it('starts from the welcome screen with nothing done', () => {
    expect(resumeStep(EMPTY, NOW)).toBe('welcome');
  });

  it('goes back to the plate, then the photos, then the review while the number check is fresh', () => {
    expect(resumeStep(CHECKED, NOW)).toBe('vehicle');
    const vehicle = { ...CHECKED, plate: 'ABC 1234', route: 'R4' };
    expect(resumeStep(vehicle, NOW)).toBe('photos');
    expect(resumeStep({ ...vehicle, uploaded: { id: true, vehicle: false } }, NOW)).toBe('photos');
    expect(resumeStep({ ...vehicle, uploaded: { id: true, vehicle: true } }, NOW)).toBe('review');
  });

  it('starts again once the check is older than the hour the server allows', () => {
    const old = { ...CHECKED, checkedAtMs: NOW - 60 * MIN };
    expect(checkFresh(old, NOW)).toBe(false);
    expect(resumeStep(old, NOW)).toBe('welcome');
    expect(checkFresh({ ...CHECKED, checkedAtMs: NOW - 59 * MIN }, NOW)).toBe(true);
  });

  it('only waits once the registration is submitted', () => {
    expect(resumeStep({ ...EMPTY, token: 'x'.repeat(43) }, NOW)).toBe('waiting');
  });
});

describe('photo size', () => {
  it('picks the largest camera size within 1,600 px on the long side', () => {
    expect(pickPictureSize(['4000x3000', '1920x1080', '1600x1200', '1280x720', '640x480'])).toBe('1600x1200');
    expect(pickPictureSize(['1200x1600', '1920x1080'])).toBe('1200x1600');
  });

  it('falls back to the smallest size, and to the camera\'s own choice with none offered', () => {
    expect(pickPictureSize(['4000x3000', '2048x1536'])).toBe('2048x1536');
    expect(pickPictureSize(['Photo', 'High'])).toBeNull();
    expect(pickPictureSize([])).toBeNull();
  });

  it('refuses a photo over 1 MB, and lets an unknown size through', () => {
    expect(photoTooBig(1_000_000)).toBe(false);
    expect(photoTooBig(1_000_001)).toBe(true);
    expect(photoTooBig(null)).toBe(false);
  });
});

describe('waiting', () => {
  it('reads the statuses and treats anything else as unknown', () => {
    for (const status of ['pending', 'approved', 'rejected', 'collected', 'expired'] as const) expect(waitingStatus(status)).toBe(status);
    expect(waitingStatus('archived')).toBe('unknown');
    expect(waitingStatus(null)).toBe('unknown');
  });

  it('collects only an approved registration; rejected, expired and unknown ones start again', () => {
    expect(mayCollect('approved')).toBe(true);
    expect(mayCollect('pending')).toBe(false);
    expect(mayCollect('collected')).toBe(false);
    for (const status of ['rejected', 'expired', 'unknown'] as const) expect(mustRegisterAgain(status)).toBe(true);
    for (const status of ['pending', 'approved', 'collected'] as const) expect(mustRegisterAgain(status)).toBe(false);
  });
});
