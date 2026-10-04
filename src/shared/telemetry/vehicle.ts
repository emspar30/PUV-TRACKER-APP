// What the app knows about one public utility vehicle (PUV) at a moment, whether the data is
// simulated (Demo mode, AF3) or comes from the relay later (L1). Pure types: no React Native or Expo imports.

export type SpeedSample = { atMs: number; speedKmh: number };

export type VehicleSnapshot = {
  id: string;
  // Shown to people: a demo plate such as "DEMO 01", never a real plate or name
  label: string;
  routeCode: string;
  lineId: string;
  lat: number;
  lon: number;
  // Direction of travel, degrees clockwise from north
  headingDeg: number;
  speedKmh: number;
  seatsTaken: number;
  // When the last position was received; the age decides Live, Stale or No data
  lastPacketMs: number;
  // Recent speeds, oldest first, for the stopped check
  recentSpeeds: readonly SpeedSample[];
  // True for simulated vehicles; they are always labelled "Demo"
  demo: boolean;
};
