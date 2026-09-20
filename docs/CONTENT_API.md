# UMRT Content API

This is the contract between the front end and whatever serves its content.

Right now nothing serves it: the site reads committed JSON through a static
adapter that returns the exact envelope described below, including cursor
pagination. Every screen therefore already exercises the paginated code path —
the infinite archive on `/achievements` is not special-cased for local data.

**To switch to a real backend, set one environment variable:**

```bash
NEXT_PUBLIC_UMRT_CONTENT_API=https://api.example.org
```

No component changes. If the variable is unset or empty, the static adapter is
used.

---

## 1. Where things live

| Path | What it is |
| --- | --- |
| `lib/content/types.ts` | The wire types. This file *is* the schema. |
| `lib/content/client.ts` | The only door between UI and content. Picks remote or static. |
| `lib/content/local.ts` | Static adapter over `data/content/*.json`. |
| `lib/content/useContent.ts` | React hooks (`useContentCollection`, `useContentRecords`). |
| `data/content/*.json` | The current data. Replace these with real endpoints. |
| `data/media-manifest.json` | Generated media index. See §5. |

Components import from `@/lib/content` and never from the adapters underneath.

---

## 2. Endpoints

All under `/{API_BASE}/v1`.

```
GET /v1/achievements
GET /v1/events
GET /v1/crew
GET /v1/partners
GET /v1/sections
GET /v1/divisions
GET /v1/teamTiers
GET /v1/certificates
GET /v1/media

GET /v1/{resource}/{id}
```

### Query parameters

| Parameter | Meaning |
| --- | --- |
| `cursor` | Opaque page cursor. Omit for the first page. |
| `limit` | Records per page. The client asks for 8–100. |
| *anything else* | Treated as an equality filter on the field of that name. |

Filters the front end actually sends today:

```
GET /v1/media?tag=rover          # containment match against `tags[]`
GET /v1/media?tag=promo
```

The static adapter matches a scalar query value against a scalar field by
string equality, and against an array field by containment. `tag` is aliased to
the `tags` field. A real backend should behave the same way for these two, and
may ignore filters it does not implement — but must not return records that
fail a filter it *does* claim to support.

### Collection response

```jsonc
{
  "data": [ /* records */ ],
  "page": {
    "cursor": "o:0",        // cursor that produced this page, or null
    "nextCursor": "o:8",    // pass back for the next page; null when exhausted
    "limit": 8,
    "total": 17,            // total matching records, or null if unknown
    "hasMore": true
  },
  "meta": {
    "resource": "achievements",
    "schemaVersion": 1,
    "revision": "arch-2026-09-02",  // changes when the data changes
    "static": false
  }
}
```

`data` is the only required key. The client rebuilds `page` and `meta`
defensively, so a missing `page` degrades to "one page, no more data" rather
than throwing inside a render. Still, **please send `total`** — the archive
sizes its scroll section from it, and without it the page grows under the
reader as records stream in.

Cursors are opaque to the client. The static adapter uses `o:{offset}`; use
whatever you like.

### Single response

```jsonc
{ "data": { /* one record */ }, "meta": { /* as above */ } }
```

`404` for an unknown id is expected and returns `null` to callers. Any other
non-2xx throws `ContentApiError`.

---

## 3. Record shapes

Authoritative definitions are in `lib/content/types.ts`. Summary:

### `achievements` — the orbital archive on `/achievements`

```jsonc
{
  "id": "urc-2026-third-worldwide",
  "year": "2026",
  "date": "2026-05-31",              // ISO, used for ordering
  "title": "3RD WORLDWIDE",          // rendered uppercase, keep it short
  "category": "Field result",        // see AchievementCategory in types.ts
  "metric": "URC / 03",              // short figure in the card footer
  "description": "…",
  "media": "urc26-team-banner",      // media id, resolved asset, or null
  "featured": true                   // optional
}
```

**Order matters.** The archive renders records in the order received — index 0
is the first card the reader meets. Sort newest-first unless you mean
otherwise.

**The archive is unbounded.** Eleven card slots are recycled across the whole
collection, so a thousand records cost the same as ten. The client requests the
next page once the reader is within six records of the end of what it holds.

### `events` — the deployment log on the home page

```jsonc
{
  "id": "urc-2026",
  "name": "University Rover Challenge 2026",
  "date": "2026-05-31",
  "year": "2026",
  "venue": "URC field site",
  "kind": "competition",             // competition | exhibition | summit | campus | festival
  "summary": "…",
  "media": ["urc26-team-banner", "…"],   // first entry is the lead image
  "stats": [{ "label": "Result", "value": "3rd worldwide" }]
}
```

### `crew`

```jsonc
{
  "id": "saif-al-saad",
  "name": "Saif Al Saad",
  "role": "Team Lead",
  "unit": null,                      // sub-team, or null
  "rank": 1,                         // 0 mentor, 1 lead, 2 senior, 3 sub-lead, 4 member
  "portrait": "crew-saif-al-saad",
  "card": "crew-card-saif-al-saad"
}
```

The home page shows `rank <= 3` only. `data/content/crew.json` is **generated**
by `scripts/build-media-library.mjs` from the roster in
`scripts/media-sources.mjs`; edit it there, not by hand.

`focus` (string array) and `socials` (`{ linkedin?, github?, email?, website? }`)
are optional and not currently populated — a backend may add them per member
and the team pages will render them.

### `divisions` — engineering sub-teams on /team/architecture and /team/core

```jsonc
{
  "id": "mechanical",
  "sysCode": "SYS-01",
  "name": "Mechanical Team",
  "description": "…",
  "highlights": ["Structural design and fabrication", "…"],
  "specs": [{ "label": "…", "value": "…" }],   // optional
  "color": "#3B82F6",                          // optional accent, hex
  "iconHint": "gear",                          // optional: gear | zap | code | flask | briefcase | camera | signal
  "leadId": "siam-ibne-sarwar",                // crew id, or null if unled
  "memberIds": ["riad-hossen", "…"]            // crew ids, excluding the lead
}
```

Membership is an explicit id list against `crew`, not a match on
`CrewMember.unit` — renaming a division, moving someone between divisions, or
adding a brand new division never requires touching the (generated) crew
roster. `leadId`/`memberIds` pointing at an id `crew` does not have are
silently dropped rather than breaking the page.

### `teamTiers` — command structure on /team/leadership

```jsonc
{
  "id": "advisory",
  "order": 1,                    // lower sorts first
  "badge": "TIER-1",
  "label": "Faculty Advisory Board",
  "description": "…",            // optional
  "cardVariant": "hero",         // optional: hero | default | compact
  "memberIds": ["abid-hossain"]
}
```

The tier list is entirely data — a backend can rename a tier, reorder tiers,
or add a new one (an "Alumni Board" tier, say) and the leadership page renders
it with no frontend change. A tier with no resolvable members renders nothing.

### `sections` — editorial copy for the home page

Without this resource, every photograph on the page would be editable but the
sentence above it frozen in JSX. One record per section:

```jsonc
{
  "id": "surface-record",
  "index": "08",                                  // chapter number in the eyebrow
  "kicker": "Surface record / field photography",
  "echo": "FIELD",                                // stroke-only word behind the headline
  "title": {                                      // three-part, matching the hero
    "lead": "THE MACHINE,",                       //   solid
    "outline": "ON REAL",                         //   outlined
    "accent": "GROUND."                           //   solar orange
  },
  "lede": "Every frame here is the actual rover — …",
  "specs": [{ "label": "Frames logged", "value": "{count}" }],
  "footSpecs": [ /* optional second table, used by the film panel */ ],
  "footnote": "Full {headcount}-person roster in preparation"
}
```

**`{token}` placeholders** are substituted at render time with live figures, so
copy stays editable without hard-coding numbers that would go stale. Tokens are
supplied per section by its component:

| Section | Tokens |
| --- | --- |
| `surface-record` | `{count}` |
| `transmission-film` | `{filmTitle}` `{runtime}` `{renditions}` `{payload}` `{maxHeight}` |
| `outreach-log` | `{count}` `{frames}` |
| `crew-teaser` | `{headcount}` `{units}` `{leads}` |

An unknown token is left in place rather than blanked, so a typo is visible
rather than silent. A section whose record is missing renders nothing at all.

The current ids are `surface-record`, `transmission-film`, `outreach-log`,
`crew-teaser` and `partner-marks`. Adding a record does **not** create a
section — each one is a component; this resource only supplies its words.

### `certificates` — the registry behind /certificates

```jsonc
{
  "id": "UMRT-CERT-2025-001",
  "recipient": { "name": "Arafat Rahman", "aliases": [] },   // aliases: alternate spellings, searchable
  "title": "Certificate of Contribution",
  "program": "University Rover Challenge 2025",
  "role": "Autonomous Navigation Subsystem",
  "issuedOn": "2025-06-30",                                  // ISO date
  "status": "valid",                                          // valid | revoked
  "description": "…"
}
```

The verifier fetches every page via `listAllContent` and builds its own ID/name
lookup index client-side (`lib/certificateRegistry.ts`) — search is exact-match
against a certificate's `id` or against `recipient.name`/`recipient.aliases`,
case- and whitespace-normalized. A record that fails structural validation
(bad date, missing fields, duplicate id) is dropped from the index with a
console error rather than breaking the page for every other certificate — the
one resource here where that matters most, since the whole page exists to
assert a record is trustworthy.

The issuing org's name/location are UI copy (`ISSUER` in
`CertificateValidator.tsx`), not part of this resource — they describe UMRT
itself, not a certificate.

### `partners`

```jsonc
{
  "id": "uiu",
  "name": "United International University",
  "shortName": "UIU",
  "role": "Host institution",
  "href": "https://www.uiu.ac.bd",   // or null
  "mark": "mark-uiu"
}
```

### `media`

See §5. Serving `/v1/media` is optional — if you do not, the front end still
resolves media ids against its committed manifest.

---

## 4. Media references

Records point at media by **id**, never by path:

```json
{ "media": "urc26-team-banner" }
```

The client resolves that id against `data/media-manifest.json` before handing
the record to a component, so payloads stay small and re-encoding an image
never invalidates content.

If you would rather serve resolved assets, send the whole `MediaAsset` object
in place of the string. Both are accepted — `resolveMediaRef` passes an object
through untouched. An id that resolves to nothing becomes `null`; components
render without the image rather than breaking.

---

## 5. The media library

`data/media-manifest.json` is generated, not authored:

```bash
node scripts/build-media-library.mjs            # everything, incremental
node scripts/build-media-library.mjs --images   # stills only
node scripts/build-media-library.mjs --videos   # renditions + posters only
node scripts/build-media-library.mjs --force    # re-encode everything
```

It reads `RESOURCES/` (camera originals, ~1.3 GB, **not committed**), writes
responsive WebP ladders and MP4 renditions into `public/media/`, and emits the
manifest. Sources are declared in `scripts/media-sources.mjs` — that file also
carries every asset's id, alt text, caption, tags, and curation order.

Each asset:

```jsonc
{
  "id": "urc26-team-banner",
  "collection": "urc",
  "kind": "image",                   // or "video"
  "order": 11,                       // curation order
  "width": 4160, "height": 3120,
  "aspectRatio": 1.33333,
  "alt": "…",
  "caption": "…",
  "tags": ["urc", "competition", "crew", "hero"],
  "blurDataUrl": "data:image/webp;base64,…",   // ~20px placeholder
  "src": "/media/urc/urc26-team-banner-1600.webp",
  "srcSet": "/media/urc/urc26-team-banner-480.webp 480w, …",  // ascending by width
  "sources": [ /* video only: [{ height, url, type, bytes }] */ ],
  "durationSeconds": 75.31            // video only
}
```

If the backend serves media, keep `blurDataUrl`, `aspectRatio` and `srcSet` —
they are what stop the page shifting as photography streams in.

The manifest is imported straight into the client bundle, so every field it
carries is downloaded by every visitor. Two things follow. A `variants` array
is **not** emitted: it duplicated the ladder `srcSet` already encodes, for all
117 assets, and nothing read it — `pickVariant` parses `srcSet` instead. The
type still accepts `variants`, so a server may send it. And `srcSet` must be
ordered ascending by width, because `pickVariant` relies on that rather than
sorting at runtime.

Running the script without `RESOURCES/` present leaves the committed manifest
untouched, so a checkout that has only the derivatives still builds.

---

## 6. Failure behaviour

- A non-2xx response throws `ContentApiError`.
- `useContentCollection` surfaces `status: 'error'` and `error`, and exposes
  `reload()`. The archive renders a retry control on error.
- A malformed envelope degrades rather than throws.
- Duplicate ids across pages are dropped — the archive is index-addressed and
  would otherwise desynchronise.
- In-flight requests abort on unmount and when filters change.
