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
  /** Ascending by width. `pickVariant` parses the ladder out of this. */
  srcSet: string;
  /**
   * Optional. The generated manifest does not ship this — it duplicated what
   * `srcSet` already encodes, for every asset, in the client bundle. A backend
   * may still send it; nothing in the app depends on it.
   */
  variants?: MediaVariant[];
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

export interface SocialLinks {
  linkedin?: string;
  github?: string;
  email?: string;
  website?: string;
}

export interface CrewMember {
  id: string;
  name: string;
  role: string;
  /** Sub-team, when the member belongs to one. Display label only — see DivisionRecord for structural grouping. */
  unit: string | null;
  /** Lower sorts first: mentor 0, lead 1, sub-lead 2, member 3. */
  rank: number;
  portrait: MediaRef | null;
  /** The pre-composed roster graphic with the name baked in. */
  card: MediaRef | null;
  /** Optional focus areas, shown on the team pages when present. */
  focus?: string[];
  /** Optional external links, shown on the team pages when present. */
  socials?: SocialLinks;
}

/**
 * Editorial copy for one page section.
 *
 * Without this, headings, kickers and standfirsts would be the one part of
 * the site a backend could not reach — every photograph editable but the
 * sentence above it frozen in JSX. Values may contain `{token}` placeholders;
 * the component supplies live figures (record counts, runtimes) for them, so
 * copy stays editable without hard-coding numbers that would go stale.
 */
export interface SectionRecord {
  id: string;
  /** Two-digit chapter number, continuing the mission's own numbering. */
  index: string;
  kicker: string;
  /** Stroke-only word set behind the headline. */
  echo: string;
  /** Three-part headline: solid, outlined, then the solar-orange close. */
  title: { lead: string; outline: string; accent: string };
  lede: string;
  specs: { label: string; value: string }[];
  /** Optional second spec table, used by the film panel's footer. */
  footSpecs?: { label: string; value: string }[];
  /** Optional line rendered beneath the section body. */
  footnote?: string;
}

export interface PartnerRecord {
  id: string;
  name: string;
  shortName: string;
  role: string;
  href: string | null;
  mark: MediaRef | null;
}

/**
 * An engineering division/sub-team on /team/architecture and /team/core.
 *
 * Membership is an explicit id list rather than a match against
 * `CrewMember.unit` — renaming or restructuring a division then never
 * requires touching the (generated) crew roster. A backend is free to move
 * people between divisions, add a division, or retire one; the frontend only
 * ever renders whatever list of records it is given.
 */
export interface DivisionRecord {
  id: string;
  /** Telemetry system code, e.g. "SYS-01". */
  sysCode: string;
  name: string;
  description: string;
  /** Bulleted engineering highlights. Empty array renders nothing. */
  highlights: string[];
  /** Compact telemetry spec pills. */
  specs?: { label: string; value: string }[];
  /** Accent color (hex) for this division's tab/graphics. */
  color?: string;
  /** Icon glyph hint for the architecture page graphic. Unknown values fall back to a default mark. */
  iconHint?: string;
  /** Crew id leading this division, or absent/null if currently unled. */
  leadId?: string | null;
  /** Crew ids belonging to this division, excluding the lead. */
  memberIds: string[];
}

/**
 * One tier of the command structure on /team/leadership — e.g. "Faculty
 * Advisory Board" or "Command Nodes". The tier list itself is data: a backend
 * can rename a tier, reorder tiers, or add a new one (an "Alumni Board" tier,
 * say) without any frontend change.
 */
export interface TeamTierRecord {
  id: string;
  /** Lower sorts first. */
  order: number;
  /** Short badge, e.g. "TIER-1". */
  badge: string;
  label: string;
  description?: string;
  /** Card size used for members in this tier. */
  cardVariant?: 'hero' | 'default' | 'compact';
  /** Crew ids shown in this tier, in display order. */
  memberIds: string[];
}

export type CertificateStatus = 'valid' | 'revoked';

/** One credential in the certificate registry on /certificates. */
export interface CertificateRecord {
  id: string;
  recipient: {
    name: string;
    /** Alternate spellings the same recipient might be searched by. */
    aliases: string[];
  };
  title: string;
  program: string;
  role: string;
  /** ISO date. */
  issuedOn: string;
  status: CertificateStatus;
  description: string;
}

/** Resource names accepted by the client. */
export type ResourceName =
  | 'achievements'
  | 'events'
  | 'crew'
  | 'partners'
  | 'sections'
  | 'divisions'
  | 'teamTiers'
  | 'certificates'
  | 'media';

export interface ResourceMap {
  achievements: AchievementRecord;
  events: EventRecord;
  crew: CrewMember;
  partners: PartnerRecord;
  sections: SectionRecord;
  divisions: DivisionRecord;
  teamTiers: TeamTierRecord;
  certificates: CertificateRecord;
  media: MediaAsset;
}
