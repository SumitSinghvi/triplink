// In-memory stand-in for the Supabase query-builder calls used in src/lib/server/*.
// Supports: select/insert/upsert/update/delete, eq/neq/in/gte/or, order, limit, maybeSingle.
type Row = Record<string, unknown>;
type Err = { code?: string; message: string };
type Result = { data: unknown; error: Err | null };

const PK: Record<string, string[]> = {
  auth_otps: ['phone'],
  flight_lookups: ['flight_key', 'travel_date'],
};
const pkOf = (table: string) => PK[table] ?? ['id'];

// Split on commas not inside parentheses.
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function matchTerm(row: Row, term: string): boolean {
  if (term.startsWith('and(')) return splitTop(term.slice(4, -1)).every((t) => matchTerm(row, t));
  const [col, op, ...rest] = term.split('.');
  if (op !== 'eq') throw new Error(`fake: unsupported or-op ${op}`);
  return String(row[col]) === rest.join('.');
}

export class FakeSupabase {
  tables: Record<string, Row[]> = {};
  /** table -> columns that do not exist yet (simulates unapplied migrations). */
  missingColumns: Record<string, string[]> = {};
  private failures: { table: string; op?: string; error: Err }[] = [];
  calls: { table: string; op: string; payload?: unknown }[] = [];

  seed(table: string, rows: Row[]) {
    this.tables[table] = [...(this.tables[table] ?? []), ...rows.map((r) => ({ ...r }))];
    return this;
  }
  rows(table: string): Row[] {
    return this.tables[table] ?? [];
  }
  /** Next matching call on `table` (optionally only `op`) returns this error once. */
  failNext(table: string, error: Err = { message: 'boom' }, op?: string) {
    this.failures.push({ table, op, error });
  }
  takeFailure(table: string, op: string): Err | null {
    const i = this.failures.findIndex((f) => f.table === table && (!f.op || f.op === op));
    return i >= 0 ? this.failures.splice(i, 1)[0].error : null;
  }
  from(table: string) {
    return new Builder(this, table);
  }
}

class Builder implements PromiseLike<Result> {
  private op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private payload: Row | Row[] | null = null;
  private filters: ((r: Row) => boolean)[] = [];
  private cols = '*';
  private orderBy: { col: string; asc: boolean } | null = null;
  private max = Infinity;
  private returning = false;
  private single = false;

  constructor(private db: FakeSupabase, private table: string) {}

  select(cols = '*') {
    if (this.op === 'select') this.cols = cols;
    else {
      this.returning = true;
      this.cols = cols;
    }
    return this;
  }
  insert(p: Row | Row[]) { this.op = 'insert'; this.payload = p; return this; }
  upsert(p: Row | Row[]) { this.op = 'upsert'; this.payload = p; return this; }
  update(p: Row) { this.op = 'update'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this; }
  neq(c: string, v: unknown) { this.filters.push((r) => r[c] !== v); return this; }
  in(c: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[c])); return this; }
  gte(c: string, v: unknown) { this.filters.push((r) => (r[c] as string) >= (v as string)); return this; }
  or(expr: string) {
    const terms = splitTop(expr);
    this.filters.push((r) => terms.some((t) => matchTerm(r, t)));
    return this;
  }
  order(col: string, o?: { ascending?: boolean }) { this.orderBy = { col, asc: o?.ascending !== false }; return this; }
  limit(n: number) { this.max = n; return this; }
  maybeSingle() { this.single = true; return this; }

  then<A = Result, B = never>(
    ok?: ((v: Result) => A | PromiseLike<A>) | null,
    bad?: ((e: unknown) => B | PromiseLike<B>) | null
  ) {
    return Promise.resolve().then(() => this.run()).then(ok, bad);
  }

  private missing(keys: string[]): string | undefined {
    const gone = this.db.missingColumns[this.table] ?? [];
    return keys.find((k) => gone.includes(k));
  }

  private run(): Result {
    const { db, table } = this;
    db.calls.push({ table, op: this.op, payload: this.payload });
    const injected = db.takeFailure(table, this.op);
    if (injected) return { data: null, error: injected };

    const keys =
      this.op === 'select'
        ? this.cols === '*' ? [] : this.cols.split(',').map((c) => c.trim())
        : Object.keys((Array.isArray(this.payload) ? this.payload[0] : this.payload) ?? {});
    const bad = this.missing(keys);
    if (bad) return { data: null, error: { code: '42703', message: `column ${table}.${bad} does not exist` } };

    const all = (db.tables[table] ??= []);
    const matches = () => all.filter((r) => this.filters.every((f) => f(r)));
    const project = (r: Row): Row => {
      if (this.cols === '*') return { ...r };
      return Object.fromEntries(this.cols.split(',').map((c) => c.trim()).map((c) => [c, r[c]]));
    };

    if (this.op === 'insert' || this.op === 'upsert') {
      const pk = pkOf(table);
      const inserted: Row[] = [];
      for (const p of Array.isArray(this.payload) ? this.payload : [this.payload!]) {
        const idx = all.findIndex((r) => pk.every((k) => r[k] === p[k]));
        if (idx >= 0) {
          if (this.op === 'insert') return { data: null, error: { code: '23505', message: 'duplicate key' } };
          all[idx] = { ...all[idx], ...p };
          inserted.push(all[idx]);
        } else {
          const row = { ...p, created_at: p.created_at ?? new Date().toISOString() };
          all.push(row);
          inserted.push(row);
        }
      }
      return { data: this.returning ? inserted.map(project) : null, error: null };
    }
    if (this.op === 'update') {
      const hit = matches();
      hit.forEach((r) => Object.assign(r, this.payload));
      return { data: this.returning ? hit.map(project) : null, error: null };
    }
    if (this.op === 'delete') {
      const hit = new Set(matches());
      db.tables[table] = all.filter((r) => !hit.has(r));
      return { data: null, error: null };
    }

    let out = matches();
    if (this.orderBy) {
      const { col, asc } = this.orderBy;
      out = [...out].sort(
        (a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (asc ? 1 : -1)
      );
    }
    out = out.slice(0, this.max);
    if (this.single) return { data: out[0] ? project(out[0]) : null, error: null };
    return { data: out.map(project), error: null };
  }
}
