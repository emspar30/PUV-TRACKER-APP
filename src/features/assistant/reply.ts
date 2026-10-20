import type { Answer } from '@/shared/assistant/answer';
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

// CA1: an answer in words, with the chips that act on it
export function replyOf(answer: Answer, fareType: Classification): Reply {
  const a = strings.assistant;
  switch (answer.kind) {
    case 'trip': {
      const route = a.tripRoute(answer.routeCode, answer.routeName);
      const fare = a.tripFare(strings.format.peso(answer.fare), strings.classification.short[fareType]);
      const lines = answer.focus === 'fare' ? [fare, route] : [route, fare];
      lines.push(a.tripEnds(answer.from.title, answer.to.title, strings.format.km(answer.rideKm)));
      lines.push(a.tripWalks(strings.format.meters(answer.walkToM), strings.format.meters(answer.walkFromM)));
      if (answer.others.length > 0) lines.push(a.tripOthers(a.and(answer.others)));
      const from = answer.from.mine ? null : { lat: answer.from.lat, lon: answer.from.lon, title: answer.from.title };
      return {
        lines,
        chips: [
          { label: a.chips.openTrip, action: { kind: 'openTrip', from, to: answer.to, route: answer.routeCode } },
          viewRoute(answer.routeCode),
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
      return { lines: [line], chips: [] };
    }
    case 'choose': {
      const slot = answer.intent.kind === 'trip' ? answer.intent[answer.slot === 'from' ? 'from' : 'to'] : answer.intent.kind === 'nearest' ? answer.intent.near : null;
      const text = slot && 'text' in slot ? slot.text : '';
      return {
        lines: [a.choose(text)],
        chips: answer.options.map((place) => ({
          label: a.chips.choice(place.title, place.near),
          action: { kind: 'ask', question: place.title, intent: withChoice(answer.intent, answer.slot, place) },
        })),
      };
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
          a.nearest(answer.stop.code, answer.stop.name, distance(answer.distanceM), answer.from.title),
          ...(answer.routes.length > 0 ? [a.nearestRoutes(a.and(answer.routes))] : []),
        ],
        chips: answer.routes.map(statusChip),
      };
    case 'help':
      return { lines: [...a.help], chips: [...STARTER_CHIPS] };
  }
}
