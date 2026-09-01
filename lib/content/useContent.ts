'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isRemoteContentApi, listContent } from './client';
import { listLocal } from './local';
import { resolveMediaRef, resolveMediaRefs } from './media';
import type {
  AchievementRecord,
  CollectionQuery,
  CrewMember,
  EventRecord,
  PartnerRecord,
  ResourceMap,
  ResourceName,
} from './types';

/**
 * React bindings for the content API.
 *
 * The archive on /achievements drives a WebGL scene whose section height is
 * derived from the record count, so a first page that arrives one tick late
 * would resize the document under the reader. When no server is configured
 * the first page is therefore seeded synchronously from the static adapter;
 * with a server it streams normally and consumers show their own pending
 * state. Both paths run the same pagination code.
 */

export type CollectionStatus = 'loading' | 'ready' | 'error';

export interface CollectionState<T> {
  records: T[];
  /** Total across all pages when known, else null. */
  total: number | null;
  hasMore: boolean;
  status: CollectionStatus;
  error: Error | null;
}

export interface UseContentCollectionOptions {
  /** Records per page. */
  limit?: number;
  /** Extra filters forwarded to the API as query parameters. */
  params?: CollectionQuery;
  /** Keep requesting pages until the collection is exhausted. */
  loadAll?: boolean;
  /** Skip fetching entirely (used to defer work until a section is near). */
  enabled?: boolean;
}

function hydrateLocal<R extends ResourceName>(resource: R, records: ResourceMap[R][]) {
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

/**
 * Synchronous first page, static adapter only. Returns null against a live
 * server so the hook falls back to its normal async path.
 */
function seedCollection<R extends ResourceName>(
  resource: R,
  query: CollectionQuery,
): { state: CollectionState<ResourceMap[R]>; nextCursor: string | null } | null {
  if (isRemoteContentApi) return null;
  const response = listLocal(resource, query);
  return {
    state: {
      records: hydrateLocal(resource, response.data),
      total: response.page.total,
      hasMore: response.page.hasMore,
      status: 'ready',
      error: null,
    },
    nextCursor: response.page.nextCursor,
  };
}

const EMPTY_PARAMS: CollectionQuery = {};

export function useContentCollection<R extends ResourceName>(
  resource: R,
  options: UseContentCollectionOptions = {},
): CollectionState<ResourceMap[R]> & { loadMore: () => void; reload: () => void } {
  const { limit = 12, params = EMPTY_PARAMS, loadAll = false, enabled = true } = options;

  // Filters usually arrive as a fresh object literal each render. Key on the
  // serialised value so the effect below re-runs on real changes only.
  const paramsKey = useMemo(() => JSON.stringify(params), [params]);
  const query = useMemo<CollectionQuery>(
    () => ({ ...(JSON.parse(paramsKey) as CollectionQuery), limit }),
    [limit, paramsKey],
  );

  const [generation, setGeneration] = useState(0);
  const seed = useMemo(
    () => (enabled ? seedCollection(resource, query) : null),
    // `generation` is part of the key so reload() re-seeds too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, generation, query, resource],
  );

  const [state, setState] = useState<CollectionState<ResourceMap[R]>>(
    () => seed?.state ?? { records: [], total: null, hasMore: true, status: 'loading', error: null },
  );

  const cursorRef = useRef<string | null>(seed?.nextCursor ?? null);
  const loadingRef = useRef(false);
  const exhaustedRef = useRef(seed ? !seed.state.hasMore : false);
  const abortRef = useRef<AbortController | null>(null);
  const generationRef = useRef(generation);

  // A change of resource, filters, or generation invalidates everything that
  // is in flight and resets the accumulated pages.
  useEffect(() => {
    generationRef.current = generation;
    abortRef.current?.abort();
    abortRef.current = null;
    loadingRef.current = false;

    const nextSeed = enabled ? seedCollection(resource, query) : null;
    cursorRef.current = nextSeed?.nextCursor ?? null;
    exhaustedRef.current = nextSeed ? !nextSeed.state.hasMore : false;
    setState(
      nextSeed?.state
        ?? { records: [], total: null, hasMore: true, status: enabled ? 'loading' : 'ready', error: null },
    );

    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [enabled, generation, query, resource]);

  const loadMore = useCallback(() => {
    if (!enabled || loadingRef.current || exhaustedRef.current) return;
    loadingRef.current = true;

    const controller = new AbortController();
    abortRef.current = controller;
    const requestGeneration = generationRef.current;

    listContent(resource, { ...query, cursor: cursorRef.current }, { signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted || requestGeneration !== generationRef.current) return;
        cursorRef.current = response.page.nextCursor;
        exhaustedRef.current = !response.page.hasMore || !response.page.nextCursor;
        setState((current) => {
          // Guard against a server that replays a page: appending duplicates
          // would desynchronise the archive's index-addressed layout.
          const seen = new Set(current.records.map((record) => (record as { id: string }).id));
          const fresh = response.data.filter((record) => !seen.has((record as { id: string }).id));
          return {
            records: current.records.concat(fresh),
            total: response.page.total,
            hasMore: !exhaustedRef.current,
            status: 'ready',
            error: null,
          };
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || requestGeneration !== generationRef.current) return;
        setState((current) => ({
          ...current,
          status: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
        }));
      })
      .finally(() => {
        if (requestGeneration === generationRef.current) loadingRef.current = false;
      });
  }, [enabled, query, resource]);

  // Fetch the first page when there was nothing to seed (i.e. a live server).
  useEffect(() => {
    if (!enabled || seed) return;
    loadMore();
  }, [enabled, loadMore, seed]);

  useEffect(() => {
    if (!loadAll || !enabled) return;
    if (state.status === 'ready' && state.hasMore) loadMore();
  }, [enabled, loadAll, loadMore, state.hasMore, state.status]);

  const reload = useCallback(() => setGeneration((value) => value + 1), []);

  return { ...state, loadMore, reload };
}

/** Small collections that are always wanted in full: crew, partners, events. */
export function useContentRecords<R extends ResourceName>(
  resource: R,
  options: Omit<UseContentCollectionOptions, 'loadAll'> = {},
) {
  return useContentCollection(resource, { limit: 100, ...options, loadAll: true });
}
