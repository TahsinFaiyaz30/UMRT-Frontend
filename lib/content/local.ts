import achievementsData from '@/data/content/achievements.json';
import crewData from '@/data/content/crew.json';
import eventsData from '@/data/content/events.json';
import partnersData from '@/data/content/partners.json';

import { listMediaAssets } from './media';
import type {
  CollectionQuery,
  CollectionResponse,
  ResourceMap,
  ResourceName,
} from './types';

/**
 * Static adapter: serves the committed JSON under `data/content/` through the
 * exact envelope a real server would return, including cursor pagination.
 *
 * This is what runs until `NEXT_PUBLIC_UMRT_CONTENT_API` is configured. Every
 * consumer therefore exercises the paginated code path from day one — the
 * infinite archive on /achievements is not special-cased for local data, so
 * switching to a live backend changes nothing in the components.
 */

type Dataset = {
  revision: string;
  records: unknown[];
};

const datasets: Record<Exclude<ResourceName, 'media'>, Dataset> = {
  achievements: achievementsData as Dataset,
  events: eventsData as Dataset,
  crew: crewData as Dataset,
  partners: partnersData as Dataset,
};

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 100;

/** Cursors are opaque to callers; the static adapter encodes an offset. */
function encodeCursor(offset: number) {
  return `o:${offset}`;
}

function decodeCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0;
  const match = /^o:(\d+)$/.exec(cursor);
  if (!match) return 0;
  return Number(match[1]);
}

/** Reserved query keys are transport concerns, not record filters. */
const TRANSPORT_KEYS = new Set(['cursor', 'limit']);

/**
 * REST reads better in the singular for a containment filter (`?tag=rover`)
 * than as the plural field it matches against.
 */
const FILTER_ALIASES: Record<string, string> = {
  tag: 'tags',
};

function matchesFilters(record: unknown, query: CollectionQuery) {
  if (typeof record !== 'object' || record === null) return false;
  const source = record as Record<string, unknown>;

  for (const [key, value] of Object.entries(query)) {
    if (TRANSPORT_KEYS.has(key) || value === undefined || value === null) continue;

    const field = source[FILTER_ALIASES[key] ?? key];
    // Array fields (tags, media) match if they contain the value; scalars
    // compare stringified so `?year=2026` works against a string year.
    if (Array.isArray(field)) {
      if (!field.some((entry) => String(entry) === String(value))) return false;
    } else if (String(field) !== String(value)) {
      return false;
    }
  }

  return true;
}

function recordsFor(resource: ResourceName): unknown[] {
  if (resource === 'media') return [...listMediaAssets()];
  return datasets[resource].records;
}

function revisionFor(resource: ResourceName): string {
  if (resource === 'media') return 'media';
  return datasets[resource].revision;
}

export function listLocal<R extends ResourceName>(
  resource: R,
  query: CollectionQuery = {},
): CollectionResponse<ResourceMap[R]> {
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(query.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT),
  );
  const offset = decodeCursor(query.cursor);

  const matched = recordsFor(resource).filter((record) => matchesFilters(record, query));
  const slice = matched.slice(offset, offset + limit) as ResourceMap[R][];
  const nextOffset = offset + slice.length;
  const hasMore = nextOffset < matched.length;

  return {
    data: slice,
    page: {
      cursor: query.cursor ?? null,
      nextCursor: hasMore ? encodeCursor(nextOffset) : null,
      limit,
      total: matched.length,
      hasMore,
    },
    meta: {
      resource,
      schemaVersion: 1,
      revision: revisionFor(resource),
      static: true,
    },
  };
}

export function getLocal<R extends ResourceName>(
  resource: R,
  id: string,
): ResourceMap[R] | null {
  const match = recordsFor(resource).find(
    (record) => (record as { id?: unknown }).id === id,
  );
  return (match as ResourceMap[R] | undefined) ?? null;
}
