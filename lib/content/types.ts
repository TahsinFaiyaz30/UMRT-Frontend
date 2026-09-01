/**
 * Domain types for the UMRT content API.
 *
 * These describe the wire format, not just the local JSON. A backend that
 * serves the shapes in this file is a drop-in replacement for the static
 * adapter in `local.ts` — see `docs/CONTENT_API.md`.
 */

/* ------------------------------------------------------------------ *
 *  Transport envelope                                                 *
 * ------------------------------------------------------------------ */

/** Cursor pagination state returned with every collection response. */
export interface PageInfo {
  /** Opaque cursor for the page that was returned (null for the first page). */
  cursor: string | null;
  /** Opaque cursor to pass back for the next page. Null when exhausted. */
  nextCursor: string | null;
  /** Number of records requested. */
  limit: number;
  /**
   * Total records matching the query across all pages, when the source can
   * count cheaply. Null means "unknown" — consumers must then rely on
   * `nextCursor` alone and cannot pre-size a scrollbar.
   */
  total: number | null;
  hasMore: boolean;
}

export interface CollectionResponse<T> {
  data: T[];
  page: PageInfo;
  meta: {
    resource: string;
    schemaVersion: number;
    /** Content revision. Changes whenever the underlying data changes. */
    revision: string;
    /** True when served by the built-in static adapter rather than a server. */
    static: boolean;
  };
}

export interface SingleResponse<T> {
  data: T;
  meta: CollectionResponse<T>['meta'];
}

export interface CollectionQuery {
  cursor?: string | null;
  limit?: number;
  /** Free-form filters. The static adapter matches them against record fields. */
  [key: string]: string | number | boolean | null | undefined;
}

/* ------------------------------------------------------------------ *
 *  Media                                                              *
 * ------------------------------------------------------------------ */

export interface MediaVariant {
  width: number;
  height: number;
  url: string;
  bytes: number;
}

export interface MediaVideoSource {
  height: number;
  url: string;
  type: string;
  bytes: number;
}

export interface MediaAsset {
  id: string;
  collection: string;
  kind: 'image' | 'video';
  /** Intrinsic dimensions of the original, after EXIF rotation. */
  width: number;
  height: number;
  aspectRatio: number;
  alt: string;
  caption?: string;
  title?: string;
  tags: string[];
  hasAlpha?: boolean;
  /** Inline ~20px WebP used as a blur-up placeholder. */
  blurDataUrl: string;
  /** Largest still (or the poster frame, for video). */
  src: string;
  srcSet: string;
  variants: MediaVariant[];
  /** Present only when `kind === 'video'`. */
  sources?: MediaVideoSource[];
  durationSeconds?: number | null;
}

/**
 * How records point at media. A backend may send either the bare ID or the
 * resolved asset; `resolveMediaRef` accepts both.
 */
export type MediaRef = string | MediaAsset;

/* ------------------------------------------------------------------ *
 *  Resources                                                          *
 * ------------------------------------------------------------------ */

export type AchievementCategory =
  | 'Field result'
  | 'International'
  | 'Award'
  | 'Autonomy'
  | 'Qualification'
  | 'Engineering'
  | 'Outreach'
  | 'Origin';

/** One record in the orbital archive on /achievements. */
export interface AchievementRecord {
  id: string;
  /** Display year. */
  year: string;
  /** ISO date used for ordering; day precision is not always meaningful. */
  date: string;
  title: string;
  category: AchievementCategory;
  /** Short all-caps figure rendered in the card footer. */
  metric: string;
  description: string;
  /** Optional hero image for the card face. */
  media?: MediaRef | null;
  /** Where the record can be corroborated, if anywhere. */
  source?: { label: string; href: string } | null;
  /** Marks records the team considers headline results. */
  featured?: boolean;
}

/** Outreach, exhibition and competition appearances. */
export interface EventRecord {
  id: string;
  name: string;
  /** ISO date. */
  date: string;
  year: string;
  venue: string;
  kind: 'competition' | 'exhibition' | 'summit' | 'campus' | 'festival';
  summary: string;
  /** Ordered gallery for the event. */
  media: MediaRef[];
  /** Small figures rendered as a strip under the event copy. */
  stats?: { label: string; value: string }[];
}

export interface CrewMember {
  id: string;
  name: string;
  role: string;
  /** Sub-team, when the member belongs to one. */
  unit: string | null;
  /** Lower sorts first: mentor 0, lead 1, sub-lead 2, member 3. */
  rank: number;
  portrait: MediaRef | null;
  /** The pre-composed roster graphic with the name baked in. */
  card: MediaRef | null;
}

export interface PartnerRecord {
  id: string;
  name: string;
  shortName: string;
  role: string;
  href: string | null;
  mark: MediaRef | null;
}

/** Resource names accepted by the client. */
export type ResourceName = 'achievements' | 'events' | 'crew' | 'partners' | 'media';

export interface ResourceMap {
  achievements: AchievementRecord;
  events: EventRecord;
  crew: CrewMember;
  partners: PartnerRecord;
  media: MediaAsset;
}
