// Clients that talk to the cloud services. In the POC they point at the local
// mock; in production they point at Microsoft. Same code path either way:
// the only difference is the base URL, the credential and the deployment name.

export class CloudError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    const cause = (err as { cause?: { message?: string; code?: string } }).cause;
    throw new CloudError(0, 'NetworkError', `${url}: ${cause?.message ?? cause?.code ?? (err as Error).message}`);
  }
  if (!res.ok) {
    let code = 'Http' + res.status;
    let message = res.statusText;
    try {
      const body: any = await res.json();
      code = body?.error?.code ?? code;
      message = body?.error?.message ?? message;
    } catch {
      /* non-JSON error body */
    }
    throw new CloudError(res.status, code, `${res.status} ${code}: ${message}`);
  }
  return res;
}

// ------------------------------------------------------------------- Graph

export type GraphPage<T> = { value: T[]; '@odata.nextLink'?: string };

export class GraphClient {
  baseUrl: string;
  token: string;
  calls: number;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
    this.calls = 0;
  }

  async get<T>(path: string): Promise<T> {
    this.calls++;
    const res = await request(this.baseUrl + path, {
      headers: { authorization: 'Bearer ' + this.token },
    });
    return (await res.json()) as T;
  }

  /** Follows @odata.nextLink so callers never see paging. */
  async getAll<T>(path: string): Promise<T[]> {
    const out: T[] = [];
    let next: string | undefined = path;
    while (next) {
      const page: GraphPage<T> = next.startsWith('http')
        ? await this.getAbsolute<T>(next)
        : await this.get<GraphPage<T>>(next);
      out.push(...page.value);
      next = page['@odata.nextLink'];
    }
    return out;
  }

  async getAbsolute<T>(url: string): Promise<T> {
    this.calls++;
    const res = await request(url, { headers: { authorization: 'Bearer ' + this.token } });
    return (await res.json()) as T;
  }

  users(): Promise<any[]> {
    return this.getAll('/users?$top=50&$expand=manager');
  }
  user(id: string): Promise<any> {
    return this.get('/users/' + id);
  }
  manager(id: string): Promise<any> {
    return this.get('/users/' + id + '/manager');
  }
  directReports(id: string): Promise<any[]> {
    return this.getAll('/users/' + id + '/directReports');
  }
  messages(userId: string): Promise<any[]> {
    return this.getAll('/users/' + userId + '/messages?$top=50');
  }
  groups(): Promise<any[]> {
    return this.getAll('/groups');
  }
  groupMembers(groupId: string): Promise<any[]> {
    return this.getAll('/groups/' + groupId + '/members');
  }
  drives(): Promise<any[]> {
    return this.getAll('/drives');
  }
  driveItems(driveId: string): Promise<any[]> {
    return this.getAll('/drives/' + driveId + '/items');
  }
  async itemContent(driveId: string, itemId: string): Promise<string> {
    this.calls++;
    const res = await request(
      this.baseUrl + '/drives/' + driveId + '/items/' + itemId + '/content',
      { headers: { authorization: 'Bearer ' + this.token } },
    );
    return res.text();
  }
  itemPermissions(driveId: string, itemId: string): Promise<any[]> {
    return this.get<GraphPage<any>>(
      '/drives/' + driveId + '/items/' + itemId + '/permissions',
    ).then((p) => p.value);
  }
}

// ------------------------------------------------------------------ Purview

export type SensitivityLabel = {
  id: string;
  name: string;
  description: string;
  sensitivity: number;
};

export class PurviewClient {
  graph: GraphClient;
  constructor(graph: GraphClient) {
    this.graph = graph;
  }
  async labels(): Promise<SensitivityLabel[]> {
    const page = await this.graph.get<GraphPage<SensitivityLabel>>(
      '/informationProtection/sensitivityLabels',
    );
    return page.value;
  }
}

// ---------------------------------------------------------------- Azure SQL

export type SqlColumn = { name: string; type: string };
export type SqlResult<T = Record<string, unknown>> = {
  /** Mirrors the `mssql` package result shape, so a real driver is a drop-in. */
  recordsets: T[][];
  recordset: T[];
  rowsAffected: number[];
  columns: SqlColumn[];
};

export type SqlPort = {
  query<T = Record<string, unknown>>(sql: string): Promise<SqlResult<T>>;
  tables(): Promise<{ name: string; columns: SqlColumn[]; rowCount: number }[]>;
};

/**
 * A local SQL engine over fixture tables. It understands the subset the
 * connectors use: SELECT list, FROM table, WHERE equality/AND, ORDER BY, TOP.
 * Anything outside that subset throws, so we notice immediately when real SQL
 * would be needed.
 */
export class LocalSqlClient implements SqlPort {
  tablesData: Record<string, { name: string; columns: SqlColumn[]; rows: Record<string, unknown>[] }>;

  constructor(tables: Record<string, { name: string; columns: SqlColumn[]; rows: Record<string, unknown>[] }>) {
    this.tablesData = tables;
  }

  async tables() {
    return Object.values(this.tablesData).map((t) => ({
      name: t.name,
      columns: t.columns,
      rowCount: t.rows.length,
    }));
  }

  async query<T = Record<string, unknown>>(sql: string): Promise<SqlResult<T>> {
    const parsed = parseSelect(sql);
    const table = Object.values(this.tablesData).find(
      (t) => t.name === parsed.from || t.name.split('.').pop() === parsed.from,
    );
    if (!table) throw new Error(`Unknown table "${parsed.from}"`);

    let rows = table.rows.slice();
    for (const [col, value] of parsed.where) {
      if (!table.columns.some((c) => c.name === col)) {
        throw new Error(`Unknown column "${col}" on ${table.name}`);
      }
      rows = rows.filter((r) => String(r[col]) === String(value));
    }
    if (parsed.orderBy) {
      const { column, direction } = parsed.orderBy;
      rows.sort((a, b) => {
        const av = a[column] as any;
        const bv = b[column] as any;
        if (av === bv) return 0;
        return (av < bv ? -1 : 1) * (direction === 'DESC' ? -1 : 1);
      });
    }
    if (parsed.top) rows = rows.slice(0, parsed.top);

    const cols =
      parsed.columns === '*'
        ? table.columns
        : table.columns.filter((c) => parsed.columns.includes(c.name));
    if (parsed.columns !== '*') {
      for (const c of parsed.columns) {
        if (!table.columns.some((x) => x.name === c)) {
          throw new Error(`Unknown column "${c}" on ${table.name}`);
        }
      }
    }
    const projected = rows.map((r) => {
      const o: Record<string, unknown> = {};
      for (const c of cols) o[c.name] = r[c.name];
      return o as T;
    });
    return {
      recordsets: [projected],
      recordset: projected,
      rowsAffected: [projected.length],
      columns: cols,
    };
  }
}

export function parseSelect(sql: string) {
  const clean = sql.replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ').trim();
  const m = /^SELECT (TOP (\d+) )?(.+?) FROM ([A-Za-z0-9_.\[\]]+)(?: WHERE (.+?))?(?: ORDER BY ([A-Za-z0-9_]+)( ASC| DESC)?)?$/i.exec(
    clean,
  );
  if (!m) throw new Error('LocalSqlClient only supports simple SELECTs: ' + sql);
  const columns = m[3] === '*' ? '*' : m[3].split(',').map((c) => c.trim().replace(/[\[\]]/g, ''));
  const where: [string, unknown][] = [];
  if (m[5]) {
    for (const clause of m[5].split(/\s+AND\s+/i)) {
      const w = /^([A-Za-z0-9_\[\]]+)\s*=\s*(.+)$/.exec(clause.trim());
      if (!w) throw new Error('Unsupported WHERE clause: ' + clause);
      where.push([w[1].replace(/[\[\]]/g, ''), parseLiteral(w[2])]);
    }
  }
  return {
    columns,
    top: m[2] ? Number(m[2]) : undefined,
    from: m[4].replace(/[\[\]]/g, ''),
    where,
    orderBy: m[6] ? { column: m[6], direction: m[7]?.trim().toUpperCase() === 'DESC' ? 'DESC' : 'ASC' } : undefined,
  };
}

function parseLiteral(raw: string): unknown {
  const t = raw.trim();
  if (/^'.*'$/.test(t)) return t.slice(1, -1).replace(/''/g, "'");
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  throw new Error('Unsupported literal: ' + t);
}

// ------------------------------------------------------------ Azure OpenAI

export type ChatResult = { content: string; usage: { prompt_tokens: number; completion_tokens: number } };

export class OpenAIClient {
  baseUrl: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
  calls: number;

  constructor(baseUrl: string, apiKey: string, deployment = 'gpt-4o', apiVersion = '2024-10-21') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.deployment = deployment;
    this.apiVersion = apiVersion;
    this.calls = 0;
  }

  async chat(input: { role: string; system: string; user: string }): Promise<ChatResult> {
    this.calls++;
    const res = await request(
      `${this.baseUrl}/openai/deployments/${this.deployment}/chat/completions?api-version=${this.apiVersion}`,
      {
        method: 'POST',
        headers: { 'api-key': this.apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: input.system },
            { role: 'user', content: input.user },
          ],
          temperature: 0,
          response_format: { type: 'json_object' },
        }),
      },
    );
    const body: any = await res.json();
    const content = body?.choices?.[0]?.message?.content ?? '';
    return { content, usage: body.usage };
  }
}
