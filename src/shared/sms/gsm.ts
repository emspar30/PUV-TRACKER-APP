import { SMS_TEXT_MAX_SEPTETS } from '../config';

// A single text SMS holds 160 GSM-7 septets (GSM 03.38). Characters in the extension table cost two:
// the heatmap's pipes ("|") among them, so a heatmap text costs its length plus 5.

const BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const EXTENSION = '\f^{}\\[~]|€';
const EXTENSION_COST = 2;

const basic = new Set(BASIC);
const extension = new Set(EXTENSION);

// Septets the text needs, or null when it has a character GSM-7 cannot carry (it would go as UCS-2)
export function gsm7Septets(text: string): number | null {
  let septets = 0;
  for (const char of text) {
    if (basic.has(char)) septets += 1;
    else if (extension.has(char)) septets += EXTENSION_COST;
    else return null;
  }
  return septets;
}

export function fitsSingleSms(text: string): boolean {
  const septets = gsm7Septets(text);
  return septets !== null && septets <= SMS_TEXT_MAX_SEPTETS;
}
