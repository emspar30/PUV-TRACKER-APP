// PRD 14: a request that never reached the server. Supabase passes the platform's own text through
// ("TypeError: Network request failed", or Android's "java.net.UnknownHostException: ..."), so the
// screens check for it and say the phone is offline instead of showing that text.
const NETWORK_FAILURE = /network request failed|failed to fetch|java\.net\.|unable to resolve host|timed? ?out|connection (refused|reset|abort)|ECONN|ENOTFOUND|socket/i;

export function isNetworkFailure(message: string | null | undefined): boolean {
  return message !== null && message !== undefined && NETWORK_FAILURE.test(message);
}
