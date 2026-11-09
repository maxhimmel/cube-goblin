# Scryfall oracle tags

Researched 2026-11-09 for removal and fixing counts in Insights ([T-004](../tickets/T-004-stats-and-charts.md)). Implemented in `packages/scryfall/src/oracle-tags.ts`.

- **What**: community tags from the Tagger project that describe what a card does (removal, ramp, draw). Scryfall moderates them but does not guarantee them; they change daily ([tags](https://scryfall.com/docs/api/tags)).
- **Not on card objects**: `/cards/*` responses carry no tag field. Search supports `otag:`, `oracletag:` and `function:` ([syntax](https://scryfall.com/docs/syntax)).
- **Bulk file**: `GET /bulk-data/oracle-tags` returns `jsonl_download_uri`, a gzipped JSONL file of about 6 MB, updated daily. It has no `download_uri` (checked live). One line per tag: `id`, `slug`, `label`, `description`, `parent_ids`, `child_ids`, `aliases`, `taggings[]` (`oracle_id`, `weight`, `annotation`) ([tags](https://scryfall.com/docs/api/tags), [bulk data](https://scryfall.com/docs/api/bulk-data)).
- **Parents have no direct taggings**: `removal` and `draw` list zero cards; their cards sit on children (`removal-destroy`, `removal-exile`, …). Walk `child_ids` to reproduce `otag:` search. Walking `removal` gives 6751 cards (checked 2026-11-09).
- **Track by `id`**: slugs and labels may change. Scryfall recommends a way to switch off individual tags.
- **No fixing tag**: no tag named or aliased fixing exists. `fetchland` and `rainbow-land` do; color-producing cards are found with the card's `produced_mana` field instead.
- **Search alternative**: `otag:removal (oracleid:… or …)` works but `q` is capped at 1000 characters (about 18 ids), so the bulk file is cheaper.

## How the app uses it

- `OracleTagStore` downloads the bulk file at most once a day and keeps only the tracked tags (and their descendants) in `.cache/scryfall/oracle-tags.json`. Offline, it serves the last file, however old. The tracked tags live in `packages/cube/src/functions.ts`.
