// CA1: a trip handed to My Rides in the route's parameters (Ask Tunton's "Open in My Rides"). Both
// sides use these two functions, so what is written is what is read. Pure data, for unit tests.

export type TripPoint = { lat: number; lon: number; title: string };

// A start of null keeps My Rides' own (the user's position). `at` makes each tap new, so the tab
// applies it once.
export function tripParams(trip: { from: TripPoint | null; to: TripPoint; route: string }, at: number): Record<string, string> {
  const { from, to, route } = trip;
  return {
    toLat: String(to.lat),
    toLon: String(to.lon),
    toTitle: to.title,
    ...(from ? { fromLat: String(from.lat), fromLon: String(from.lon), fromTitle: from.title } : {}),
    route,
    at: String(at),
  };
}

// A point read back from the parameters, or null when any part is missing or not a number
export function pointParam(lat: string | undefined, lon: string | undefined, title: string | undefined): { lat: number; lon: number; label: string } | null {
  if (!lat || !lon || !title) return null;
  const point = { lat: Number(lat), lon: Number(lon) };
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) return null;
  return { ...point, label: title };
}
