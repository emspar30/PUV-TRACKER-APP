import { SMS_SEQ_MODULUS, SMS_TEXT_MAX_SEPTETS, DATA_SMS_MAX_BYTES } from '../config';
import { encodeHeatmapBinary, heatmapBinarySize } from './binary';
import { gsm7Septets } from './gsm';
import { signHeatmap, type HeatmapNode } from './protocol';

// One route's waiting counts as signed messages for one driver phone (PRD 9.6, 12.3; DR6).
// A message lists stops and their counts; the driver app merges them (listed stops update, others
// keep their value), so a long route is split over several messages, each with its own sequence
// number, without changing the format. Stops keep the order given (the riding order).

export type HeatmapEncoding = 'text' | 'data';

export type HeatmapBatch = {
  route: string;
  // Sequence number of the first message; the next ones follow, wrapping at SMS_SEQ_MODULUS
  firstSeq: number;
  minuteOfDay: number;
  nodes: readonly HeatmapNode[];
};

export type OutgoingHeatmap = {
  seq: number;
  // The signed text (what the driver validates)
  text: string;
  // The data-SMS bytes, for the data encoding
  data: Uint8Array | null;
};

// The text format carries at most three digits
const MAX_COUNT = 999;
// Stand-ins of the right length, to measure a message before it is signed
const SEQ_STANDIN = '0000';
const TIME_STANDIN = '0000';
const MAC_STANDIN = '00000000';

const capped = (nodes: readonly HeatmapNode[]) => nodes.map(({ code, count }) => ({ code, count: Math.min(count, MAX_COUNT) }));

function fits(route: string, nodes: readonly HeatmapNode[], encoding: HeatmapEncoding, v3: boolean): boolean {
  if (encoding === 'data') return heatmapBinarySize(nodes.map((node) => node.code), v3) <= DATA_SMS_MAX_BYTES;
  const list = nodes.map(({ code, count }) => `${code}:${count}`).join(',');
  const head = v3 ? `HM3|${route}|${SEQ_STANDIN}|${TIME_STANDIN}|F` : `HM2|${route}|${SEQ_STANDIN}|${TIME_STANDIN}`;
  const septets = gsm7Septets(`${head}|${list || '-'}|${MAC_STANDIN}`);
  return septets !== null && septets <= SMS_TEXT_MAX_SEPTETS;
}

// The stops of each message, in order. The worker reserves one sequence number per message.
export function chunkHeatmapNodes(route: string, nodes: readonly HeatmapNode[], encoding: HeatmapEncoding, v3 = false): HeatmapNode[][] {
  const chunks: HeatmapNode[][] = [];
  let current: HeatmapNode[] = [];
  for (const node of capped(nodes)) {
    if (fits(route, [...current, node], encoding, v3)) {
      current.push(node);
      continue;
    }
    if (current.length === 0) throw new RangeError(`one stop does not fit a message: ${node.code}`);
    chunks.push(current);
    current = [node];
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export function buildHeatmapMessages(batch: HeatmapBatch, key: string, encoding: HeatmapEncoding): OutgoingHeatmap[] {
  const { route, firstSeq, minuteOfDay, nodes } = batch;
  return chunkHeatmapNodes(route, nodes, encoding).map((chunk, index) => {
    const seq = (firstSeq + index) % SMS_SEQ_MODULUS;
    const text = signHeatmap({ route, seq, minuteOfDay, nodes: chunk }, key);
    return { seq, text, data: encoding === 'data' ? encodeHeatmapBinary(text) : null };
  });
}

// CA2-1 (v3): the whole route's counts, sending only the stops with someone waiting. The first
// message is F (every stop not listed is 0), any next one P; nobody waiting anywhere is one F
// message with an empty list. Stops keep the order given.
function updateChunks(route: string, nodes: readonly HeatmapNode[], encoding: HeatmapEncoding): HeatmapNode[][] {
  const waiting = nodes.filter((node) => node.count > 0);
  return waiting.length === 0 ? [[]] : chunkHeatmapNodes(route, waiting, encoding, true);
}

// How many messages (sequence numbers) buildHeatmapUpdate will make
export function heatmapUpdateSize(route: string, nodes: readonly HeatmapNode[], encoding: HeatmapEncoding): number {
  return updateChunks(route, nodes, encoding).length;
}

export function buildHeatmapUpdate(batch: HeatmapBatch, key: string, encoding: HeatmapEncoding): OutgoingHeatmap[] {
  const { route, firstSeq, minuteOfDay, nodes } = batch;
  return updateChunks(route, nodes, encoding).map((chunk, index) => {
    const seq = (firstSeq + index) % SMS_SEQ_MODULUS;
    const text = signHeatmap({ route, seq, minuteOfDay, nodes: chunk, full: index === 0 }, key);
    return { seq, text, data: encoding === 'data' ? encodeHeatmapBinary(text) : null };
  });
}
