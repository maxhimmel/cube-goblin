# Scryfall API

Read 2026-11-08 from [scryfall.com/docs/api](https://scryfall.com/docs/api). Implemented in `packages/scryfall`; CLI in `apps/cli`.

## Rules we must follow

- **Headers**: every request needs an accurate `User-Agent` (app name/version, e.g. `MTGExampleApp/1.0`) and an `Accept` header ([overview](https://scryfall.com/docs/api)).
- **Rate limits**: `/cards/search`, `/cards/named`, `/cards/random`, `/cards/collection` allow 2/second (500ms). `/cards/manifest` allows 10/minute. Everything else allows 10/second (100ms). Image hosts on `*.scryfall.io` have no limit. A 429 locks you out for 30s, and ignoring 429s can get the app banned ([rate limits](https://scryfall.com/docs/api/rate-limits)).
- **Caching**: cache data for at least 24h. Use bulk data for large lookups ([rate limits](https://scryfall.com/docs/api/rate-limits)).
- **Data use**: no paywalling, no implying Scryfall endorsement, no plain republishing. Card images can't be cropped, distorted, color-shifted, or watermarked, and the copyright and artist line must stay visible ([overview](https://scryfall.com/docs/api)).

## Endpoints used

- **`GET /cards/named`**: takes `exact` or `fuzzy`, plus optional `set`, `format`, and `version`. A 404 means no match or an ambiguous fuzzy match ([named](https://scryfall.com/docs/api/cards/named)).
- **`GET /cards/search`**: takes `q` (max 1000 chars), `unique`, `order`, `dir`, and `page`. Returns pages of 175 cards with `has_more`/`next_page` ([search](https://scryfall.com/docs/api/cards/search)).
- **`POST /cards/collection`**: body `{ "identifiers": [...] }`, up to 75 identifiers. Identifier shapes: `id`, `mtgo_id`, `multiverse_id`, `oracle_id`, `illustration_id`, `name`, `name`+`set`, `collector_number`+`set`. Misses come back in `not_found`. Gotcha: the response has no `has_more` field ([collection](https://scryfall.com/docs/api/cards/collection)).
- **Errors**: `{ status, code, details, type?, warnings? }` ([errors](https://scryfall.com/docs/api/errors)).

## Printings

Read 2026-11-10 from [search](https://scryfall.com/docs/api/cards/search), [cards](https://scryfall.com/docs/api/cards), and [/cards/:id](https://scryfall.com/docs/api/cards/id).

- **`unique=prints`** returns every printing of the matched cards instead of one per card. `include_variations=true` adds rare variants; `include_extras=true` adds tokens, planes, and the like (not needed for printings).
- **`oracleid:<id>`** in `q` matches every printing of one card. Each card object also has `prints_search_uri`, a ready-made link to the same list.
- **Digital printings**: the list includes Alchemy and other digital-only printings; `game:paper` in `q` drops them.
- **Verified 2026-11-10**: `!"Lightning Bolt"` with `unique=prints` returned 83 printings, including borderless, showcase, extended art, Secret Lair bonus cards (`sldbonus` promo type), and The List (`plst`).
- **Labels**: `border_color` (`borderless`), `frame_effects` (`showcase`, `extendedart`, `inverted`, `etched`), `full_art`, `frame` (`1993`, `1997` for old frames), `promo_types`, `set_name`, `collector_number`, `released_at`, and `artist` describe a printing.
- **`GET /cards/:id`** returns one printing by Scryfall ID; `POST /cards/collection` takes `{ "id": ... }` identifiers for many.

## Bulk data (not used yet)

- Daily gzipped JSONL files ([bulk data](https://scryfall.com/docs/api/bulk-data)).
- `oracle_cards` has one card per Oracle ID, about 24 MB compressed.
- Gameplay data rarely changes; a weekly refresh is enough.
- A good fit later for offline cube analysis.

## Access note

The docs pages return 403 to WebFetch but load with `curl` and a `User-Agent` header.
