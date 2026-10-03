// The time-based greeting from Tunton, the app's persona (PRD 19, D11). The period follows the
// Asia/Manila clock, not the phone's time zone. The lines themselves live in the strings file.

import {
  GREETING_AFTERNOON_START_H,
  GREETING_EVENING_START_H,
  GREETING_MORNING_START_H,
  GREETING_NIGHT_START_H,
  MANILA_UTC_OFFSET_MIN,
} from '../config';

export type GreetingPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

const MS_PER_MINUTE = 60000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;

// Minutes since 1970-01-01 00:00 on the Manila clock
const manilaMinutes = (date: Date) => Math.floor(date.getTime() / MS_PER_MINUTE) + MANILA_UTC_OFFSET_MIN;

export function manilaHour(date: Date): number {
  const minuteOfDay = ((manilaMinutes(date) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return Math.floor(minuteOfDay / MINUTES_PER_HOUR);
}

export function greetingPeriod(date: Date): GreetingPeriod {
  const hour = manilaHour(date);
  if (hour >= GREETING_NIGHT_START_H || hour < GREETING_MORNING_START_H) return 'night';
  if (hour >= GREETING_EVENING_START_H) return 'evening';
  if (hour >= GREETING_AFTERNOON_START_H) return 'afternoon';
  return 'morning';
}

// One line for the period. The variant changes from day to day and stays the same within a day.
export function pickGreeting(variants: Readonly<Record<GreetingPeriod, readonly string[]>>, date: Date): string {
  const lines = variants[greetingPeriod(date)];
  if (lines.length === 0) return '';
  const day = Math.floor(manilaMinutes(date) / MINUTES_PER_DAY);
  return lines[((day % lines.length) + lines.length) % lines.length];
}
