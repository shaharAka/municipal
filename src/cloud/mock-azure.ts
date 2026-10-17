// A local stand-in for the three cloud surfaces the platform reads:
//
//   Microsoft Graph   /v1.0/users, /messages, /drives, /permissions ...
//   Purview labels    /v1.0/informationProtection/sensitivityLabels
//   Azure OpenAI      /openai/deployments/{deployment}/chat/completions
//
// The point is fidelity of the *surface*, not of the data: same paths, same
// OData envelope (@odata.context, value, @odata.nextLink, @odata.deltaLink),
// same auth style (Bearer for Graph, api-key for Azure OpenAI), same error
// shape. Point GRAPH_BASE_URL at https://graph.microsoft.com/v1.0 and a real
// token, and the client code is unchanged.

import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Fixture, GraphMessage, GraphUser, DriveItem, Permission } from './fixtures.ts';
import { runLocalModel } from './local-model.ts';

export type MockCloudOptions = {
  fixture: Fixture;
  /** Bearer token Graph clients must present. */
  graphToken: string;
  /** api-key Azure OpenAI clients must present. */
  openaiKey: string;
};

const json = (res: ServerResponse, status: number, body: unknown) => {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'request-id': 'mock-' + Math.random().toString(36).slice(2, 10),
  });
  res.end(text);
};

const graphError = (res: ServerResponse, status: number, code: string, message: string) =>
  json(res, status, { error: { code, message, innerError: { 'request-id': 'mock' } } });

/** Graph returns a user without internal fields; manager is a navigation property. */
function toGraphUser(u: GraphUser, fixture: Fixture, expandManager = false) {
  const base: Record<string, unknown> = {
    id: u.id,
    displayName: u.displayName,
    givenName: u.givenName,
    surname: u.surname,
    mail: u.mail,
    userPrincipalName: u.userPrincipalName,
    jobTitle: u.jobTitle,
    department: u.department,
    officeLocation: u.officeLocation,
    accountEnabled: u.accountEnabled,
    employeeType: u.employeeType,
    businessPhones: [],
    preferredLanguage: 'he-IL',
  };
  if (expandManager && u.managerId) {
    const m = fixture.users.find((x) => x.id === u.managerId);
    if (m) {
      base.manager = {
        '@odata.type': '#microsoft.graph.user',
        id: m.id,
        displayName: m.displayName,
        mail: m.mail,
        jobTitle: m.jobTitle,
      };
    }
  }
  return base;
}

function toGraphMessage(m: GraphMessage) {
  return {
    '@odata.type': '#microsoft.graph.message',
    id: m.id,
    conversationId: m.conversationId,
    subject: m.subject,
    bodyPreview: m.bodyPreview,
    body: m.body,
    from: m.from,
    toRecipients: m.toRecipients,
    ccRecipients: m.ccRecipients,
    receivedDateTime: m.receivedDateTime,
    sentDateTime: m.sentDateTime,
    isRead: m.isRead,
    hasAttachments: m.hasAttachments,
    webLink: m.webLink,
    sensitivityLabel: m.sensitivityLabel,
  };
}

function toGraphDriveItem(d: DriveItem) {
  return {
    '@odata.type': '#microsoft.graph.driveItem',
    id: d.id,
    name: d.name,
    size: d.size,
    file: d.file,
    folder: d.folder,
    createdDateTime: d.createdDateTime,
    lastModifiedDateTime: d.lastModifiedDateTime,
    webUrl: d.webUrl,
    parentReference: { path: d.parentPath },
    sensitivityLabel: d.sensitivityLabel,
  };
}

/**
 * A deliberately small local model behind the Azure OpenAI-compatible surface.
 * Deterministic, so scenario evals can assert exact answers; it is not a quality
 * proxy, and the role benchmark (slice 10) measures real models.
 */
function chatCompletion(body: any) {
  const messages: { role: string; content: string }[] = body?.messages ?? [];
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  const user = messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n');
  const roleMatch = /ROLE:\s*([a-z-]+)/i.exec(system);
  const role = (roleMatch?.[1] ?? 'answer').toLowerCase();
  const content = runLocalModel(role, system, user);
  return {
    id: 'chatcmpl-mock-' + Buffer.from(user).length.toString(36),
    object: 'chat.completion',
    created: Math.floor(Date.parse('2026-10-17T08:00:00Z') / 1000),
    model: body?.model ?? 'gpt-4o-2024-08-06',
    choices: [
      { index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' },
    ],
    usage: {
      prompt_tokens: Math.ceil((system.length + user.length) / 4),
      completion_tokens: Math.ceil(content.length / 4),
      total_tokens: Math.ceil((system.length + user.length + content.length) / 4),
    },
  };
}

export function createMockCloud(options: MockCloudOptions) {
  const { fixture } = options;

  const requireBearer = (req: IncomingMessage, res: ServerResponse): boolean => {
    const auth = req.headers.authorization ?? '';
    if (auth !== 'Bearer ' + options.graphToken) {
      graphError(res, 401, 'InvalidAuthenticationToken', 'Access token validation failure.');
      return false;
    }
    return true;
  };

  const page = <T>(req: IncomingMessage, url: URL, items: T[], basePath: string) => {
    const top = Math.min(Number(url.searchParams.get('$top') ?? 100) || 100, 999);
    const skip = Number(url.searchParams.get('$skiptoken') ?? 0) || 0;
    const slice = items.slice(skip, skip + top);
    const next = skip + top < items.length ? skip + top : null;
    // A nextLink must be followed literally, so it carries the caller's own
    // host and the full path (a user id lives in it).
    const self = `http://${req.headers.host}${url.pathname}`;
    return {
      '@odata.context': `https://graph.microsoft.com/v1.0/$metadata#${basePath}`,
      value: slice,
      ...(next
        ? { '@odata.nextLink': `${self}?$skiptoken=${next}&$top=${top}` }
        : {}),
    };
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;

    try {
      // ---------------- Azure OpenAI (api-key auth, different host in production)
      if (path.startsWith('/openai/')) {
        if (req.headers['api-key'] !== options.openaiKey) {
          return json(res, 401, {
            error: { code: '401', message: 'Access denied due to invalid subscription key.' },
          });
        }
        if (req.method !== 'POST') return json(res, 405, { error: { code: '405', message: 'Method not allowed' } });
        const body = await readJson(req);
        const deployment = /\/deployments\/([^/]+)/.exec(path)?.[1] ?? 'unknown';
        return json(res, 200, chatCompletion({ ...body, model: deployment }));
      }

      // ---------------- Purview sensitivity labels
      if (path === '/v1.0/informationProtection/sensitivityLabels') {
        if (!requireBearer(req, res)) return;
        return json(res, 200, {
          '@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#informationProtection/sensitivityLabels',
          value: fixture.labels.map((l) => ({
            id: l.id,
            name: l.name,
            description: l.description,
            sensitivity: l.sensitivity,
            color: l.color,
            isActive: true,
          })),
        });
      }

      // ---------------- Graph
      if (path === '/v1.0/$metadata') {
        if (!requireBearer(req, res)) return;
        res.writeHead(200, { 'content-type': 'application/xml' });
        return res.end('<?xml version="1.0"?><edmx:Edmx Version="4.0"/>');
      }

      if (!path.startsWith('/v1.0/')) {
        return graphError(res, 404, 'ResourceNotFound', 'Unknown path ' + path);
      }
      if (!requireBearer(req, res)) return;

      const rest = path.slice('/v1.0/'.length);
      const parts = rest.split('/').filter(Boolean);

      // /users  (supports $expand=manager, $filter=department eq '...')
      if (parts[0] === 'users' && parts.length === 1) {
        const expand = (url.searchParams.get('$expand') ?? '').includes('manager');
        let users = fixture.users;
        const filter = url.searchParams.get('$filter');
        const deptMatch = filter ? /department\s+eq\s+'([^']*)'/.exec(filter) : null;
        if (deptMatch) users = users.filter((u) => u.department === deptMatch[1]);
        return json(res, 200, page(req, url, users.map((u) => toGraphUser(u, fixture, expand)), 'users'));
      }

      // /users/delta  (incremental sync)
      if (parts[0] === 'users' && parts[1] === 'delta') {
        return json(res, 200, {
          '@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#users',
          value: fixture.users.map((u) => toGraphUser(u, fixture, false)),
          '@odata.deltaLink': `http://${req.headers.host}/v1.0/users/delta?$deltatoken=after-sync-1`,
        });
      }

      // /users/{id}
      if (parts[0] === 'users' && parts.length === 2 && parts[1] !== 'delta') {
        const u = fixture.users.find((x) => x.id === parts[1]);
        if (!u) return graphError(res, 404, 'Request_ResourceNotFound', 'User not found');
        return json(res, 200, toGraphUser(u, fixture, true));
      }

      // /users/{id}/manager
      if (parts[0] === 'users' && parts[2] === 'manager') {
        const u = fixture.users.find((x) => x.id === parts[1]);
        if (!u) return graphError(res, 404, 'Request_ResourceNotFound', 'User not found');
        if (!u.managerId) return graphError(res, 404, 'Request_ResourceNotFound', 'Manager not found');
        const m = fixture.users.find((x) => x.id === u.managerId)!;
        return json(res, 200, {
          '@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#users/$entity',
          id: m.id,
          displayName: m.displayName,
          mail: m.mail,
          jobTitle: m.jobTitle,
        });
      }

      // /users/{id}/directReports
      if (parts[0] === 'users' && parts[2] === 'directReports') {
        const reports = fixture.users
          .filter((x) => x.managerId === parts[1])
          .map((u) => toGraphUser(u, fixture));
        return json(res, 200, page(req, url, reports, 'users'));
      }

      // /users/{id}/messages
      if (parts[0] === 'users' && parts[2] === 'messages') {
        const uid = parts[1];
        const msgs = fixture.messages
          .filter((m) => m.participantIds.includes(uid))
          .sort((a, b) => (a.receivedDateTime < b.receivedDateTime ? 1 : -1));
        return json(res, 200, page(req, url, msgs.map(toGraphMessage), 'users/messages'));
      }

      // /groups, /groups/{id}, /groups/{id}/members
      if (parts[0] === 'groups' && parts.length === 1) {
        return json(
          res,
          200,
          page(
            req,
            url,
            fixture.groups.map((g) => ({
              id: g.id,
              displayName: g.displayName,
              mailNickname: g.mailNickname,
              description: g.description,
              groupTypes: ['Unified'],
              mailEnabled: true,
              securityEnabled: true,
            })),
            'groups',
          ),
        );
      }
      if (parts[0] === 'groups' && parts[2] === 'members') {
        const g = fixture.groups.find((x) => x.id === parts[1]);
        if (!g) return graphError(res, 404, 'Request_ResourceNotFound', 'Group not found');
        const members = g.memberIds
          .map((id) => fixture.users.find((u) => u.id === id))
          .filter((u): u is GraphUser => Boolean(u))
          .map((u) => toGraphUser(u, fixture));
        return json(res, 200, page(req, url, members, 'groups/members'));
      }

      // /drives
      if (parts[0] === 'drives' && parts.length === 1) {
        return json(
          res,
          200,
          page(
            req,
            url,
            fixture.drives.map((d) => ({
              id: d.id,
              name: d.name,
              driveType: 'documentLibrary',
              webUrl: d.webUrl,
              owner: { group: { id: fixture.groups[0].id, displayName: fixture.groups[0].displayName } },
            })),
            'drives',
          ),
        );
      }

      // /drives/{id}/root/delta
      if (parts[0] === 'drives' && parts[2] === 'root' && parts[3] === 'delta') {
        const drive = fixture.drives.find((d) => d.id === parts[1]);
        if (!drive) return graphError(res, 404, 'Request_ResourceNotFound', 'Drive not found');
        return json(res, 200, {
          '@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#drives/driveItem',
          value: drive.items.map(toGraphDriveItem),
          '@odata.deltaLink': `http://${req.headers.host}/v1.0/drives/${drive.id}/root/delta?token=after-sync-1`,
        });
      }

      // /drives/{id}/items
      if (parts[0] === 'drives' && parts[2] === 'items' && parts.length === 3) {
        const drive = fixture.drives.find((d) => d.id === parts[1]);
        if (!drive) return graphError(res, 404, 'Request_ResourceNotFound', 'Drive not found');
        return json(res, 200, page(req, url, drive.items.map(toGraphDriveItem), 'drives/items'));
      }

      // /drives/{id}/items/{itemId}
      if (parts[0] === 'drives' && parts[2] === 'items' && parts.length === 4) {
        const drive = fixture.drives.find((d) => d.id === parts[1]);
        const item = drive?.items.find((i) => i.id === parts[3]);
        if (!item) return graphError(res, 404, 'Request_ResourceNotFound', 'Item not found');
        return json(res, 200, toGraphDriveItem(item));
      }

      // /drives/{id}/items/{itemId}/content  (text extraction stands in for the parser)
      if (parts[0] === 'drives' && parts[2] === 'items' && parts[4] === 'content') {
        const drive = fixture.drives.find((d) => d.id === parts[1]);
        const item = drive?.items.find((i) => i.id === parts[3]);
        if (!item) return graphError(res, 404, 'Request_ResourceNotFound', 'Item not found');
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
        return res.end(item.contentText);
      }

      // /drives/{id}/items/{itemId}/permissions  (source of the access list)
      if (parts[0] === 'drives' && parts[2] === 'items' && parts[4] === 'permissions') {
        const perms: Permission[] = fixture.permissions[parts[3]] ?? [];
        return json(res, 200, {
          '@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#permissions',
          value: perms,
        });
      }

      return graphError(res, 404, 'ResourceNotFound', 'No route for ' + path);
    } catch (err) {
      return graphError(res, 500, 'InternalServerError', String(err));
    }
  });

  return {
    server,
    /** Start on `port` (0 picks a free one). Resolves with the bound base URL. */
    listen(port = 0): Promise<string> {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
          const addr = server.address();
          const actual = typeof addr === 'object' && addr ? addr.port : port;
          resolve('http://127.0.0.1:' + actual);
        });
      });
    },
    close(): Promise<void> {
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

function readJson(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}
