import { requireOptionalNativeModule } from 'expo';

// DR4: the driver beacon's native module (Kotlin, android/). Android only. Where the module is not
// built in (Jest, an app built before DR4), every call reports "not available" instead of throwing.

export type EventSubscription = { remove(): void };

export type BeaconSupport = {
  bluetooth: boolean;
  bluetoothOn: boolean;
  // Known only while Bluetooth is on
  advertising: boolean | null;
};

export type BeaconStatus = {
  provisioned: boolean;
  enabled: boolean;
  bluetoothOn: boolean;
  advertising: boolean;
  // The beacon service is alive. False with enabled true: the system killed the app (DR5 finding)
  running: boolean;
  lastSlot: number | null;
  lastPayloadHex: string | null;
  // not_provisioned, no_permission, bluetooth_off, not_supported, advertise_failed_<code>
  lastError: string | null;
};

export type BeaconOptions = {
  serviceUuid: string;
  version: number;
  slotSeconds: number;
  mode: string;
  txPower: string;
  notificationTitle: string;
  notificationText: string;
};

// DR8: the commuter app's scan. mode: low_latency, balanced or low_power; it stops by itself after durationMs
export type ScanOptions = {
  serviceUuid: string;
  mode: string;
  durationMs: number;
};

// "scanning", or why not. not_available: this build has no beacon module (or one from before DR8)
export type ScanStart = 'scanning' | 'no_permission' | 'bluetooth_off' | 'not_supported' | 'not_available';

// One scan result: the beacon's 9-byte code as hex, its signal and when it was heard (ms since 1970)
export type BeaconReading = { payloadHex: string; rssi: number; atMs: number };

// Why a scan ended by itself: timeout, or failed_<Android error code>
export type ScanStopped = { reason: string };

// What the native module returns; a build from before DR5's fix has no `running`
type NativeStatus = Omit<BeaconStatus, 'running'> & { running?: boolean };

type NativeBeacon = {
  getSupport(): BeaconSupport;
  provision(shortId: number, beaconSecretHex: string, smsKeyHex: string): Promise<void>;
  isProvisioned(): boolean;
  getSmsKey(): Promise<string | null>;
  clearProvisioning(): Promise<void>;
  startAdvertising(options: BeaconOptions): Promise<void>;
  stopAdvertising(): Promise<void>;
  getStatus(): NativeStatus;
  // DR8; absent in builds from before it
  startScan?(options: ScanOptions): Promise<Exclude<ScanStart, 'not_available'>>;
  stopScan?(): Promise<boolean>;
  addListener(event: 'onStatus', listener: (status: NativeStatus) => void): EventSubscription;
  addListener(event: 'onBeacon', listener: (reading: BeaconReading) => void): EventSubscription;
  addListener(event: 'onScanStopped', listener: (event: ScanStopped) => void): EventSubscription;
};

const native = requireOptionalNativeModule<NativeBeacon>('TuntonBeacon');

export const NOT_AVAILABLE: BeaconStatus = {
  provisioned: false,
  enabled: false,
  bluetoothOn: false,
  advertising: false,
  running: false,
  lastSlot: null,
  lastPayloadHex: null,
  lastError: 'not_available',
};

export const isBeaconAvailable = (): boolean => native !== null;

export function getSupport(): BeaconSupport {
  return native?.getSupport() ?? { bluetooth: false, bluetoothOn: false, advertising: null };
}

export function getStatus(): BeaconStatus {
  if (!native) return NOT_AVAILABLE;
  const status = native.getStatus();
  // An app built before `running` existed: assume the service runs (the DR4 behaviour)
  return { ...status, running: status.running ?? status.enabled };
}

export function isProvisioned(): boolean {
  return native?.isProvisioned() ?? false;
}

function required(): NativeBeacon {
  if (!native) throw new Error('The beacon module is not in this build of the app');
  return native;
}

export const provision = (shortId: number, beaconSecretHex: string, smsKeyHex: string) => required().provision(shortId, beaconSecretHex, smsKeyHex);
export const getSmsKey = () => required().getSmsKey();
export const clearProvisioning = () => required().clearProvisioning();
export const startAdvertising = (options: BeaconOptions) => required().startAdvertising(options);
export const stopAdvertising = () => required().stopAdvertising();

export function addStatusListener(listener: (status: BeaconStatus) => void): EventSubscription | null {
  return native?.addListener('onStatus', (status) => listener({ ...status, running: status.running ?? status.enabled })) ?? null;
}

// DR8: whether this build can scan (a build from before DR8 has the module without the scanner)
export const isScanAvailable = (): boolean => Boolean(native?.startScan);

// DR8: the scan never throws for a missing module; it answers not_available
export async function startScan(options: ScanOptions): Promise<ScanStart> {
  if (!native?.startScan) return 'not_available';
  return native.startScan(options);
}

export async function stopScan(): Promise<void> {
  await native?.stopScan?.();
}

export function addBeaconListener(listener: (reading: BeaconReading) => void): EventSubscription | null {
  return native?.startScan ? native.addListener('onBeacon', listener) : null;
}

export function addScanStoppedListener(listener: (event: ScanStopped) => void): EventSubscription | null {
  return native?.startScan ? native.addListener('onScanStopped', listener) : null;
}
