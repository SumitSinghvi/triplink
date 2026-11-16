import { vi } from 'vitest';

/** Return from a handler to make the call answer HTTP 500 (client falls back). */
export const FAIL = Symbol('fail');
/** Return from a handler to make /api/db answer 401. */
export const UNAUTH = Symbol('unauth');

type Handler = (args: unknown[]) => unknown | Promise<unknown>;

/**
 * Stubs global fetch for the browser-side code. `/api/db` is routed by action name to `handlers`;
 * `routes` handle other paths (e.g. '/api/pnr/verify') and receive the parsed JSON body.
 */
export function mockApi(handlers: Record<string, Handler> = {}, routes: Record<string, (body: Record<string, unknown>) => unknown> = {}) {
  const dbCalls: { action: string; args: unknown[] }[] = [];
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input), 'http://localhost').pathname;
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });

    if (url === '/api/db') {
      dbCalls.push({ action: body.action, args: body.args });
      const h = handlers[body.action];
      if (!h) return json({ error: 'unhandled' }, 500);
      const out = await h(body.args);
      if (out === FAIL) return json({ error: 'Server error' }, 500);
      if (out === UNAUTH) return json({ error: 'Not signed in' }, 401);
      return json({ result: out });
    }
    if (url === '/api/auth/logout') return json({ ok: true });
    const r = routes[url];
    if (!r) return json({ error: `no mock for ${url}` }, 500);
    const out = r(body);
    return out instanceof Response ? out : json(out);
  });
  return {
    spy,
    dbCalls,
    actions: () => dbCalls.map((c) => c.action),
    callsOf: (action: string) => dbCalls.filter((c) => c.action === action),
  };
}

export function deferred<T = void>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
