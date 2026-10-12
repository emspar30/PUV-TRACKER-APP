import { requireOptionalNativeModule } from 'expo';

// DR5: SMS in and out (Kotlin, android/). Android only. The driver app receives heatmap messages
// into a native inbox and drains it; the gateway app sends. Where the module is not built in (Jest,
// an app built before DR5), reads report "nothing" and sends throw instead of crashing.

export type EventSubscription = { remove(): void };

// One stored heatmap message. Only messages on the data port, or texts with the heatmap prefix, are
// ever stored; the sender and signature are checked in TypeScript.
export type InboxEntry = {
  kind: 'data' | 'text';
  sender: string;
  // The text, or the data message's bytes as hex
  body: string;
  // When the carrier's message centre took it (the carrier's clock)
  smscMs: number;
  // When this phone got it (this phone's clock)
  receivedMs: number;
};

export type SendResult = {
  id: string;
  stage: 'sent' | 'delivered';
  ok: boolean;
  resultCode: number;
  errorCode: number | null;
  // The delivery report's GSM status, for "delivered" only
  status: number | null;
  atMs: number;
};

export type SimInfo = {
  subscriptionId: number;
  slotIndex: number;
  carrierName: string | null;
  displayName: string | null;
};

type NativeSms = {
  canReceive(): boolean;
  configure(textPrefix: string, inboxMax: number): Promise<void>;
  disable(): Promise<void>;
  isConfigured(): boolean;
  drainInbox(): Promise<InboxEntry[]>;
  inboxSize(): number;
  canSend(): boolean;
  sendText(to: string, text: string, subscriptionId: number | null): Promise<string>;
  sendData(to: string, port: number, dataHex: string, subscriptionId: number | null): Promise<string>;
  listSims(): SimInfo[];
  addListener(event: 'onHeatmapSms', listener: () => void): EventSubscription;
  addListener(event: 'onSendResult', listener: (result: SendResult) => void): EventSubscription;
};

const native = requireOptionalNativeModule<NativeSms>('TuntonSms');

export const isSmsAvailable = (): boolean => native !== null;

export const canReceiveSms = (): boolean => native?.canReceive() ?? false;
export const canSendSms = (): boolean => native?.canSend() ?? false;
export const isInboxConfigured = (): boolean => native?.isConfigured() ?? false;
export const inboxSize = (): number => native?.inboxSize() ?? 0;
export const listSims = (): SimInfo[] => native?.listSims() ?? [];

export async function drainInbox(): Promise<InboxEntry[]> {
  return native ? native.drainInbox() : [];
}

function required(): NativeSms {
  if (!native) throw new Error('The SMS module is not in this build of the app');
  return native;
}

export const configureInbox = (textPrefix: string, inboxMax: number) => required().configure(textPrefix, inboxMax);
export const disableInbox = () => required().disable();
export const sendText = (to: string, text: string, subscriptionId: number | null = null) => required().sendText(to, text, subscriptionId);
export const sendData = (to: string, port: number, dataHex: string, subscriptionId: number | null = null) =>
  required().sendData(to, port, dataHex, subscriptionId);

export function addHeatmapSmsListener(listener: () => void): EventSubscription | null {
  return native?.addListener('onHeatmapSms', listener) ?? null;
}

export function addSendResultListener(listener: (result: SendResult) => void): EventSubscription | null {
  return native?.addListener('onSendResult', listener) ?? null;
}
