import type { Answer, PlaceMatch } from '@/shared/assistant/answer';
import { withChoice } from '@/shared/assistant/answer';
import { parseQuery, type Intent } from '@/shared/assistant/intent';
import type { Classification } from '@/shared/config';
import { strings } from '@/strings';

const METERS_PER_KM = 1000;

export type ChipAction =
  // Ask a question: the text shown as the user's message and the intent it stands for
  | { kind: 'ask'; question: string; intent: Intent }
  // My Rides with this trip; a start of null keeps My Rides' own (the user's position)
  | { kind: 'openTrip'; from: { lat: number; lon: number; title: string } | null; to: { lat: number; lon: number; title: string }; route: string }
  // The Map tab with a route shown, or just the Map
  | { kind: 'openMap'; route: string | null };

export type Chip = { label: string; action: ChipAction };
export type Reply = { lines: string[]; chips: Chip[] };

const ask = (question: string): Chip => ({ label: question, action: { kind: 'ask', question, intent: parseQuery(question) } });
const statusChip = (code: string) => ask(strings.assistant.chips.status(code));
const viewRoute = (code: string): Chip => ({ label: strings.assistant.chips.viewRoute(code), action: { kind: 'openMap', route: code } });

export const STARTER_CHIPS: readonly Chip[] = strings.assistant.starters.map(ask);

const distance = (meters: number) =>
  meters < METERS_PER_KM ? strings.format.meters(meters) : strings.format.km(meters / METERS_PER_KM);

// CA1.1: which place a name was taken as, said first, and the places that fit as well as chips that
// ask the same question again with that place
function matchLines(matches: readonly PlaceMatch[]): string[] {
  const a = strings.assistant;
  return matches.map((match) => (match.how === 'corrected' ? a.correctedFor(match.title, match.typed) : a.showingFor(match.title)));
}

function matchChips(matches: readonly PlaceMatch[], intent: Intent): Chip[] {
  return matches.flatMap((match) =>
    match.others.map((place) => ({
      label: strings.assistant.chips.didYouMean(place.title, place.near),
      action: { kind: 'ask' as const, question: place.title, intent: withChoice(intent, match.slot, place) },
    })),
  );
}

// CA1: an answer in words, with the chips that act on it. The intent is the question it answers.
export function replyOf(answer: Answer, intent: Intent, fareType: Classification): Reply {
  const a = strings.assistant;
  switch (answer.kind) {
    case 'trip': {
      const route = a.tripRoute(answer.routeCode, answer.routeName);
      const fare = a.tripFare(strings.format.peso(answer.fare), strings.classification.short[fareType]);
      const lines = [...matchLines(answer.matches), ...(answer.focus === 'fare' ? [fare, route] : [route, fare])];
      lines.push(a.tripEnds(answer.from.title, answer.to.title, strings.format.km(answer.rideKm)));
      lines.push(a.tripWalks(strings.format.meters(answer.walkToM), strings.format.meters(answer.walkFromM)));
      if (answer.others.length > 0) lines.push(a.tripOthers(a.and(answer.others)));
      const from = answer.from.mine ? null : { lat: answer.from.lat, lon: answer.from.lon, title: answer.from.title };
      return {
        lines,
        chips: [
          { label: a.chips.openTrip, action: { kind: 'openTrip', from, to: answer.to, route: answer.routeCode } },
          viewRoute(answer.routeCode),
          ...matchChips(answer.matches, intent),
        ],
      };
    }
    case 'tripFail': {
      const { from, to } = answer;
      const line =
        answer.reason === 'origin_too_far'
          ? a.tripFail.origin_too_far(from.title, distance(answer.originDistanceM ?? 0))
          : answer.reason === 'destination_too_far'
            ? a.tripFail.destination_too_far(to.title, distance(answer.destinationDistanceM ?? 0))
            : a.tripFail[answer.reason](from.title, to.title);
      return { lines: [...matchLines(answer.matches), line], chips: matchChips(answer.matches, intent) };
    }
    case 'notFound':
      return { lines: [a.notFound(answer.text)], chips: [...STARTER_CHIPS] };
    case 'needPosition':
      return {
        lines: answer.topic === 'trip' ? [a.needPosition, a.needPositionFrom] : [a.needPosition],
        chips: [{ label: a.chips.openMap, action: { kind: 'openMap', route: null } }],
      };
    case 'needDestination':
      return { lines: [a.needDestination], chips: [...STARTER_CHIPS] };
    case 'status': {
      const lines: string[] = [];
      if (answer.live > 0) lines.push(a.statusLive(answer.routeCode, answer.live));
      else lines.push(a.statusNoLive(answer.routeCode));
      if (answer.estimated > 0) lines.push(a.statusEstimated(answer.estimated));
      if (answer.stale > 0 && answer.live === 0 && answer.estimated === 0) {
        lines.push(a.statusStale(answer.stale, strings.live.age(answer.youngestAgeS ?? 0)));
      }
      if (answer.live === 0 && answer.estimated === 0 && answer.stale === 0) lines.push(a.statusNoData);
      if (answer.night) lines.push(a.statusNight);
      const chips = [viewRoute(answer.routeCode)];
      if (answer.alternative) {
        lines.push(a.statusAlternative(answer.alternative.routeCode, distance(answer.alternative.distanceM)));
        chips.push(viewRoute(answer.alternative.routeCode));
      }
      return { lines, chips };
    }
    case 'statusHidden':
      return { lines: [a.statusHidden], chips: [viewRoute(answer.routeCode)] };
    case 'statusLoading':
      return { lines: [a.statusLoading(answer.routeCode)], chips: [] };
    case 'unknownRoute':
      return { lines: [a.unknownRoute(answer.routeCode, a.and(answer.routes))], chips: answer.routes.map(statusChip) };
    case 'whichRoute':
      return { lines: [a.whichRoute], chips: answer.routes.map(statusChip) };
    case 'nearest':
      return {
        lines: [
          ...matchLines(answer.matches),
          a.nearest(answer.stop.code, answer.stop.name, distance(answer.distanceM), answer.from.title),
          ...(answer.routes.length > 0 ? [a.nearestRoutes(a.and(answer.routes))] : []),
        ],
        chips: [...answer.routes.map(statusChip), ...matchChips(answer.matches, intent)],
      };
    case 'help':
      return { lines: [...a.help], chips: [...STARTER_CHIPS] };
  }
}
