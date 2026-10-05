// B4: the slot for Bluetooth auto-fill (D5). When the rider's phone hears the multicab's beacon,
// the Bluetooth module (a later step, with its own development build) returns the vehicle here,
// and the Relay panel hides the manual Route and vehicle pickers and uses these instead.
export type BleVehicle = {
  routeCode: string;
  vehicleId: string;
  // The plate as shown to riders, e.g. "MCB 123"
  plate: string;
};

// No Bluetooth module yet: never a vehicle
export function useBleVehicle(): BleVehicle | null {
  return null;
}
