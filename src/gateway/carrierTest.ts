// DR5: the carrier test screen (app/spike.tsx) exists in development builds and in the preview-gateway
// build (EXPO_PUBLIC_CARRIER_TEST=1 in eas.json), never in a release build of the gateway app
export const carrierTestEnabled = (): boolean => __DEV__ || process.env.EXPO_PUBLIC_CARRIER_TEST === '1';
