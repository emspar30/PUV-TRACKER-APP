// DR6: driver and gateway SIM numbers are personal data (PRD 5.1), so logs show only enough to tell
// phones apart: +639171234567 -> +63917•••4567. Anything that is not a phone number is unchanged.

const E164_RE = /^(\+63\d{3})\d{3}(\d{4})$/;

export function maskPhone(value: string): string {
  const match = E164_RE.exec(value);
  return match ? `${match[1]}•••${match[2]}` : value;
}

// Every +63 mobile number inside a longer text (an error message, say)
export function maskPhonesIn(text: string): string {
  return text.replace(/\+63\d{10}/g, (number) => maskPhone(number));
}
