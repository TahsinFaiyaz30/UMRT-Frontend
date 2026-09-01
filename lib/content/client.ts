import { getLocal, listLocal } from './local';
import { resolveMediaRef, resolveMediaRefs } from './media';
import type {
  AchievementRecord,
  CollectionQuery,
  CollectionResponse,
  CrewMember,
  EventRecord,
  PartnerRecord,
  ResourceMap,
  ResourceName,
} from './types';

/**
 * The single door between the UI and its content.
 *
 * Two backends sit behind it:
 *   - the static adapter in `local.ts` (default), and
 *   - a real HTTP server, enabled by setting NEXT_PUBLIC_UMRT_CONTENT_API.
 *
 * Both return the same envelope, so no component knows which is in play. See
 * `docs/CONTENT_API.md` for the endpoint contract.
 */

const API_BASE = (process.env.NEXT_PUBLIC_UMRT_CONTENT_API ?? '').replace(/\/$/, '');
const API_VERSION = 'v1';

/** True when a live server is configured. */
export const isRemoteContentApi = API_BASE.length > 0;

export class ContentApiError extends Error {
  readonly status: number;
  readonly resource: string;

  constructor(message: string, status: number, resource: string) {
    super(message);
    this.name = 'ContentApiError';
    this.status = status;
    this.resource = resource;
  }
}

function buildUrl(resource: ResourceName, query: CollectionQuery) {
  const url = new URL(`${API_BASE}/${API_VERSION}/${resource}`);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/**
 * A server we do not control can return anything. Rather than trusting the
 * envelope, rebuild it from whatever arrived — a missing `page` block must
 * degrade to "one page, no more data" instead of throwing inside a render.
 */
function normalizeResponse<R extends ResourceName>(
  resource: R,
  payload: unknown,
  requestedLimit: number,
): CollectionResponse<ResourceMap[R]> {
  const body = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>;
  const data = Array.isArray(body.data) ? (body.data as ResourceMap[R][]) : [];
  const page = (typeof body.page === 'object' && body.page !== null ? body.page : {}) as Record<string, unknown>;
  const meta = (typeof body.meta === 'object' && body.meta !== null ? body.meta : {}) as Record<string, unknown>;

  const nextCursor = typeof page.nextCursor === 'string' && page.nextCursor ? page.nextCursor : null;

  return {
    data,
    page: {
      cursor: typeof page.cursor === 'string' ? page.cursor : null,
      nextCursor,
      limit: typeof page.limit === 'number' ? page.limit : requestedLimit,
      total: typeof page.total === 'number' ? page.total : null,
      hasMore: typeof page.hasMore === 'boolean' ? page.hasMore : nextCursor !== null,
    },
    meta: {
      resource,
      schemaVersion: typeof meta.schemaVersion === 'number' ? meta.schemaVersion : 1,
      revision: typeof meta.revision === 'string' ? meta.revision : 'unknown',
      static: false,
    },
  };
}

/**
 * Records reference media by ID so payloads stay small. Hydration happens
 * here, once, against the local manifest — a remote record that already
 * carries a resolved asset passes through untouched.
 */
function hydrateMedia<R extends ResourceName>(
  resource: R,
  records: ResourceMap[R][],
): ResourceMap[R][] {
  if (resource === 'achievements') {
    return (records as AchievementRecord[]).map((record) => ({
      ...record,
      media: resolveMediaRef(record.media),
    })) as ResourceMap[R][];
  }

  if (resource === 'events') {
    return (records as EventRecord[]).map((record) => ({
      ...record,
      media: resolveMediaRefs(record.media),
    })) as ResourceMap[R][];
  }

  if (resource === 'crew') {
    return (records as CrewMember[]).map((record) => ({
      ...record,
      portrait: resolveMediaRef(record.portrait),
      card: resolveMediaRef(record.card),
    })) as ResourceMap[R][];
  }

  if (resource === 'partners') {
    return (records as PartnerRecord[]).map((record) => ({
      ...record,
      mark: resolveMediaRef(record.mark),
    })) as ResourceMap[R][];
  }

  return records;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

/** GET /v1/:resource — a page of records, media already resolved. */
export async function listContent<R extends ResourceName>(
  resource: R,
  query: CollectionQuery = {},
  options: RequestOptions = {},
): Promise<CollectionResponse<ResourceMap[R]>> {
  if (!isRemoteContentApi) {
    const response = listLocal(resource, query);
    return { ...response, data: hydrateMedia(resource, response.data) };
  }

  const limit = Number(query.limit ?? 12);
  const response = await fetch(buildUrl(resource, query), {
    signal: options.signal,
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new ContentApiError(
      `Content API responded ${response.status} for ${resource}`,
      response.status,
      resource,
    );
  }

  const normalized = normalizeResponse(resource, await response.json(), limit);
  return { ...normalized, data: hydrateMedia(resource, normalized.data) };
}

/** GET /v1/:resource/:id — a single record, media already resolved. */
export async function getContent<R extends ResourceName>(
  resource: R,
  id: string,
  options: RequestOptions = {},
): Promise<ResourceMap[R] | null> {
  if (!isRemoteContentApi) {
    const record = getLocal(resource, id);
    return record ? hydrateMedia(resource, [record])[0] : null;
  }

  const response = await fetch(`${API_BASE}/${API_VERSION}/${resource}/${encodeURIComponent(id)}`, {
    signal: options.signal,
    headers: { Accept: 'application/json' },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new ContentApiError(
      `Content API responded ${response.status} for ${resource}/${id}`,
      response.status,
      resource,
    );
  }

  const body = await response.json();
  const record = (body?.data ?? null) as ResourceMap[R] | null;
  return record ? hydrateMedia(resource, [record])[0] : null;
}

/**
 * Convenience for callers that genuinely want everything (the crew roster,
 * the partner strip). Bounded so a runaway server cannot spin forever.
 */
export async function listAllContent<R extends ResourceName>(
  resource: R,
  query: CollectionQuery = {},
  options: RequestOptions & { maxPages?: number } = {},
): Promise<ResourceMap[R][]> {
  const maxPages = options.maxPages ?? 20;
  const records: ResourceMap[R][] = [];
  let cursor: string | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    const response: CollectionResponse<ResourceMap[R]> = await listContent(
      resource,
      { ...query, cursor, limit: query.limit ?? 100 },
      options,
    );
    records.push(...response.data);
    if (!response.page.hasMore || !response.page.nextCursor) break;
    cursor = response.page.nextCursor;
  }

  return records;
}
