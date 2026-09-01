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
  "srcSet": "/media/urc/urc26-team-banner-480.webp 480w, …",
  "variants": [{ "width": 480, "height": 360, "url": "…", "bytes": 21044 }],
  "sources": [ /* video only: [{ height, url, type, bytes }] */ ],
  "durationSeconds": 75.31            // video only
}
```

If the backend serves media, keep `blurDataUrl`, `aspectRatio` and `srcSet` —
they are what stop the page shifting as photography streams in.

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
