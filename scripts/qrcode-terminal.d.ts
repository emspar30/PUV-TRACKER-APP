// qrcode-terminal (dev dependency, DR3) ships no types; only what scripts/admin-common.ts uses
declare module 'qrcode-terminal' {
  const qrcode: {
    generate(text: string, options?: { small?: boolean }, callback?: (qr: string) => void): void;
  };
  export default qrcode;
}
