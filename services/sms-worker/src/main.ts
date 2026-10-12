// DR6: the SMS worker (PRD 9.6). Runs on the team PC (Q3): every WORKER_CYCLE_S it turns the live
// check-in counts into signed messages for each driver phone and queues them, then checks the
// gateway's health; meanwhile it serves the gateway app over HTTP (http.ts). Development:
// `npm run worker:dev`; the team PC runs the bundle (`npm run worker:build`, scripts/run-worker.ps1).
// See services/sms-worker/README.md.

import { createServer, type IncomingMessage } from 'node:http';

import { WORKER_BODY_MAX_BYTES, WORKER_CYCLE_S } from '../../../src/shared/config';

import { errorText, runCycle } from './cycle';
import { EnvError, readWorkerEnv } from './env';
import { runHealth } from './health';
import { handleRequest } from './http';
import { consoleLog, supabaseDeps } from './supabaseDeps';

const MS_PER_S = 1000;

// The body as text, or null if it passes the size limit (the rest is read and dropped, so the 413
// reply can still be sent on the same connection)
function readBody(request: IncomingMessage): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size <= WORKER_BODY_MAX_BYTES) chunks.push(chunk);
    });
    request.on('end', () => resolve(size > WORKER_BODY_MAX_BYTES ? null : Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function main() {
  let env;
  try {
    env = readWorkerEnv();
  } catch (error) {
    consoleLog('error', error instanceof EnvError ? error.message : 'could not read the settings');
    process.exit(1);
  }
  const deps = supabaseDeps(env.supabaseUrl, env.serviceRoleKey);

  // One cycle at a time: a slow database never stacks cycles up
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await runCycle(deps, { encoding: env.encoding });
      await runHealth(deps);
    } catch (error) {
      deps.log('error', 'cycle failed', { error: errorText(error) });
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => void tick(), WORKER_CYCLE_S * MS_PER_S);
  void tick();

  const server = createServer((request, response) => {
    void (async () => {
      try {
        const body = await readBody(request);
        const path = (request.url ?? '/').split('?')[0];
        const reply =
          body === null
            ? { status: 413, body: { error: 'too_large' } }
            : await handleRequest({ method: request.method ?? 'GET', path, authorization: request.headers.authorization, body }, deps);
        if (reply.status === 204) {
          response.writeHead(204).end();
        } else if (typeof reply.body === 'string') {
          response.writeHead(reply.status, { 'content-type': 'text/plain; charset=utf-8' }).end(reply.body);
        } else {
          response.writeHead(reply.status, { 'content-type': 'application/json' }).end(JSON.stringify(reply.body));
        }
      } catch (error) {
        deps.log('error', 'request handling failed', { error: errorText(error) });
        if (!response.headersSent) response.writeHead(500).end();
      }
    })();
  });
  server.listen(env.port, () => deps.log('info', 'worker started', { port: env.port, encoding: env.encoding, cycleS: WORKER_CYCLE_S }));

  const stop = (signal: string) => {
    deps.log('info', 'stopping', { signal });
    clearInterval(timer);
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
}

main();
