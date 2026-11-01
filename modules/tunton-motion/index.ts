import { requireOptionalNativeModule } from 'expo';

// V1b (D6): the phone's activity recognition (Kotlin, android/). Android only. Where the module is not
// built in (Jest, an app built before V1b), every call reports "not available" instead of throwing.

export type MotionSample = { atMs: number; inVehicle: boolean; confidence: number };

type NativeMotion = {
  available(): boolean;
  start(intervalMs: number): boolean;
  stop(): void;
  samples(sinceMs: number): MotionSample[];
};

const native = requireOptionalNativeModule<NativeMotion>('TuntonMotion');

export function motionAvailable(): boolean {
  try {
    return native?.available() ?? false;
  } catch {
    return false;
  }
}

export function startMotion(intervalMs: number): boolean {
  try {
    return native?.start(intervalMs) ?? false;
  } catch {
    return false;
  }
}

export function stopMotion(): void {
  try {
    native?.stop();
  } catch {
    // Not running
  }
}

export function motionSamples(sinceMs: number): MotionSample[] {
  try {
    return native?.samples(sinceMs) ?? [];
  } catch {
    return [];
  }
}
