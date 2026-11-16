# Cube import and export formats: Cube Cobra and Draftmancer

Researched 2026-11-15 from source: Cube Cobra at commit [`3e1d636`][cc] and Draftmancer at commit [`2c5e5ba`][dm]. Every claim links to the file it was read from. Our model: [schema.ts](../../packages/cube/src/schema.ts).

## Cube Cobra: shared rules

- **Routes**: `GET /cube/download/{cubecobra,csv,forge,mtgo,xmage,versioned,plaintext}/:id`. Cubes have no Cockatrice export; Cockatrice is a deck export only ([download.ts][cc-dl-routes], [ApiDocsPage][cc-apidocs-dl]).
- **Query params**: mainboard only by default. `?boards=mainboard,maybeboard` or `?allBoards=1` add boards, `?filter=` takes a Cube Cobra search, and `?nosort=true` keeps stored order ([download.ts][cc-dl]).
- **MIME**: every download, CSV included, is `Content-type: text/plain`, UTF-8, `\r\n` line endings, `Content-disposition: attachment; filename=<cube name with \W removed>.<ext>` ([download.ts][cc-dl], [textExport.ts][cc-text]).
- **No CORS on downloads**: download handlers set no `Access-Control-Allow-Origin`, so a browser app can't fetch them cross-origin ([download.ts][cc-dl]).
- **Card names**: split cards keep both halves (`Fire // Ice`). Every other multi-face layout (transform, MDFC, adventure, prepare) keeps the **front face only**. A card's `flavor_name` (e.g. Godzilla series) replaces its name ([update_cards utils `convertName`][cc-convertname]).
- **Name lookup on import** is an exact match on that same normalized name, with accents stripped and case folded. A full name like `Grave Researcher // Reanimate` is **not found** ([carddb `getIdsFromName`][cc-ids], [update_cards `addCardToCatalog`][cc-catalog]).
- **Text exports never quote**: line breaks and tabs in names turn into spaces ([textExport.ts][cc-text]).
- **Statuses** (enum): `Not Owned`, `Ordered`, `Owned`, `Premium Owned`, `Proxied`, `Borrowed`. **Finishes**: `Non-foil`, `Foil`, `Etched`, `Alt-foil` ([Card.ts][cc-card]).
- **Boards** are free-form names; `mainboard` and `maybeboard` are the defaults ([Card.ts `BoardType`][cc-card]).

## Cube Cobra CSV (`.csv`)

- **Header**, verbatim ([cube.ts L20][cc-csvheader]):
  `name,CMC,Type,Color,Set,Collector Number,Rarity,Color Category,status,Finish,board,maybeboard,image URL,image Back URL,tags,Notes,MTGO ID,Custom,Voucher,Artist,Voucher Cards`
- **Writer**: every data cell is wrapped in `"`, with embedded `"` doubled (RFC 4180). The header row is not quoted in a real export (user's `ArenaPoweredCube70.csv`, 2026-11-16; fixture `packages/cube/src/formats/fixtures/cubecobra-export.csv`). A text cell starting with `= + - @ \t \r` gets a `'` prefix against spreadsheet formulas, and the importer strips it again ([csv.ts][cc-csv]).
- **Fields written** ([`writeCard`][cc-writecard]):
  - name: as above.
  - CMC: override, else Scryfall `cmc`.
  - Type: override, else type line, with `—` turned into `-`.
  - Color: override, else colors, joined like `WU`.
  - Set: Scryfall `set`, lowercase.
  - Collector Number, Rarity: rarity is override, else Scryfall.
  - Color Category: `White … Colorless`, `Multicolored`, `Hybrid`, `Lands`.
  - status, Finish, board.
  - maybeboard: `true`/`false`.
  - image URL, image Back URL: overrides only, else empty.
  - tags: joined with `;`.
  - Notes, MTGO ID (-1 if none), Custom, Voucher, Artist.
  - Voucher Cards: `Name [set] 123; …`.
- **No Scryfall ID column.** The printing is rebuilt from Set plus Collector Number ([`writeCard`][cc-writecard]).
- **Import detection** (Add/bulk upload): the file counts as CSV if its first line has a `name` column; otherwise it's plain text ([cube.ts `bulkUpload` L165][cc-bulk]). **Replace with CSV** needs more than 3 commas on line 1 and accepts CSV only ([bulkreplacefile.ts L110][cc-replace]).
- **Parser**: PapaParse with `header: true`. Headers go through camelCase, so matching ignores case and spacing (`Collector Number` → `collectorNumber`). Limit: 10,000 cards ([cubefn `CSVtoCards`][cc-csvtocards], [importParsing.ts][cc-importparse]).
- **Required**: only `name`. Rows without a name are skipped ([cubefn L319][cc-csvtocards]).
- **Read**: name, CMC, Type, Color, Set, Collector Number, status, Finish, board, maybeboard, image URL, image Back URL, tags, Notes, Color Category, Rarity, Custom, Voucher, Voucher Cards.
- **Ignored**: `MTGO ID`, `Artist` ([cubefn][cc-csvtocards]).
- **Defaults**: status `Not Owned` (any string is accepted, none validated), finish `Non-foil`. Tags are split on `;` and trimmed. Image URLs must be http(s) and at most 2048 chars ([cubefn L365][cc-csvtocards]).
- **Printing pick**: exact set + collector number, then any printing in that set, then a non-promo printing, then the first ([cubefn `pickPrintingId`][cc-csvtocards]).
- **Board**: a non-empty `board` column wins, lowercased with spaces stripped. Otherwise `maybeboard=true` means maybeboard, and anything else goes to mainboard ([cubefn L400][cc-csvtocards]).
- **Custom card**: `Custom=true` stores the name as `custom_name` and matches no Scryfall card ([cubefn][cc-csvtocards]).

```csv
"name","CMC","Type","Color","Set","Collector Number","Rarity","Color Category","status","Finish","board","maybeboard","image URL","image Back URL","tags","Notes","MTGO ID","Custom","Voucher","Artist","Voucher Cards"
"Abrade","2","Instant","R","soa","37","uncommon","Red","Not Owned","Non-foil","mainboard","false","","","removal;burn","","-1","false","false","",""
```

(Constructed from the writer above, not downloaded.)

## Cube Cobra plain text exports

- **Card Names** (`/cubecobra`, `.txt`): one name per line, all selected boards merged, no headers ([download.ts `cubecobraHandler`][cc-dl]).
- **Plaintext** (`/plaintext`, `.txt`): a `# <boardname>` line, that board's names, then a blank line, repeated per board ([`plaintextHandler`][cc-dl]). The API docs say headers look like `mainboard:`, but the code writes `# mainboard` ([ApiDocsPage L590][cc-apidocs-dl]).
- **Card Versions** (`/versioned`, `.txt`): `1 Name (SET) 123`, with SET uppercase. Set and number are left out for custom cards ([textExport `setAndNumberLine`][cc-text]).
- **MTGO** (`.txt`): `N Name` with copies counted. Split cards are written `A/B`. A blank sideboard section follows ([cube.ts `exportToMtgo`][cc-writecard], [textExport `mtgoName`][cc-text]).
- **Forge** (`.dck`): `[metadata]`, `name=<cube>`, `[Main]`, then `1 Name|SET`. A `|` inside a name becomes `/` ([download.ts `forgeHandler`][cc-dl], [textExport `forgeLine`][cc-text]).
- **XMage** (`.dck`): `1 [SET:123] Name`; a card with no printing gets `1 Name` ([textExport `xmageLine`][cc-text]).
- **Text import** (bulk add): one card per line, any of `4 Plains [M20] 261`, `4 Plains (M20)`, `4x Plains`, `Plains`. The set token must contain no whitespace. Each line is capped at 100 copies. Everything lands on the board picked in the form ([importParsing `parseNonCSVLine`][cc-importparse], [BulkImportFormatHelp][cc-bulkhelp]).
- **Name only**: the cube's default printing preference picks the printing ([cube.ts `bulkUpload`][cc-bulk]).
- **`#` lines are not skipped**: the server imports `# mainboard` as a card name and reports it as missing ([cube.ts `bulkUpload`][cc-bulk]).

```text
# mainboard
Abrade
Grave Researcher
```

## Cube Cobra API (import from URL)

- **`GET /cube/api/cubeJSON/:id`** returns `application/json` with CORS `*`, rate-limited to 100 requests per minute per user or IP. `:id` takes the UUID or the short ID/slug ([cubeJSON.ts][cc-cubejson], [ApiDocsPage L260][cc-apidocs-json]).
- **Response shape**: the cube object plus `cards: { mainboard: Card[], maybeboard: Card[], … }`, every board, in default sort order.
- **Query params**: `?date=<ms>` or `?changelog=<id>` returns a past version; `?metadataOnly=true` skips the cards ([cubeJSON.ts][cc-cubejson], [ApiDocsPage L260][cc-apidocs-json]).
- **Card fields**: `cardID` is the **Scryfall printing ID**, plus `status`, `finish`, `tags[]`, `notes`, `colorCategory`, `imgUrl`, `imgBackUrl`, `custom_name`, overrides (`cmc`, `type_line`, `colors`, `rarity`), and `details` holding the Scryfall-derived data ([Card.ts `Card`][cc-card]). Draftmancer's own importer reads `cardID` and `details.{name,set,collector_number}` from this endpoint ([Draftmancer server.ts L1102][dm-server-cc], [cubeCobraIntegration.ts][dm-ccint]).
- **`GET /cube/api/cubelist/:id`**: mainboard names only, one per line, `text/plain`, CORS `*` ([cubelist.ts][cc-cubelist]).
- **Seen in a real cube** (`thepaupercube`, 2026-11-15): besides `mainboard` it had a custom `basics` board. Our import reads custom boards as prospect by default.
- **Terms**: the API docs invite tool builders to use it. They ask callers to cache responses, send a `User-Agent`, back off on 429, and respect robots.txt ([ApiDocsPage L1043][cc-apidocs-rate]).
- **Conflict**: robots.txt disallows `/cube/api/` and `/cube/download/` for generic crawlers ([robots.txt][cc-robots]), and the ToS bans "data mining, data harvesting, data extracting" ([tos.ts][cc-tos]). Safe reading: a single user-initiated fetch of one cube is fine; crawling is not.

## Draftmancer custom card list (`.txt`)

- **Spec**: [cubeformat.html][dm-doc]; parser: [parseCardList.ts][dm-parse].
- **Card line**: `[Count] CardName [(Set) [CollectorNumber]]`. A collector number needs a set ([doc][dm-doc]).
- **Actual regex**: `^(?:(\d+)\s+)?(.+?)(?:\s+\((\w+)\)(?:\s+([^+\s()]+))?)?(?:\s+\+?(F))?$`. It also accepts an undocumented foil suffix (`F` or `+F` after a space). Set codes are lowercased ([parseCardList L24][dm-parse]).
- **Names**: both `A // B` and the front face alone resolve ([ManageCardData.py L974][dm-names], [Cards.ts `getCardVersionsByName`][dm-cards]).
- **No Scryfall ID syntax**: lines can't name a printing by ID; the list resolves to Scryfall IDs internally ([Cards.ts][dm-cards]).
- **Simple list**: no `[` on the first content line means one default sheet. `#` lines are comments, and a line exactly `# maybeboard` ends the list, so Cube Cobra plaintext exports import as-is ([parseCardList L899][dm-parse]).
- **Sections**: each starts with a `[Header]` line. `[Settings]` holds loose JSON (`#` comments and trailing commas allowed), `[CustomCards]` holds a JSON array, and `[Layouts]` is deprecated. Any other header is a sheet: `[Name]`, `[Name(N)]` (N cards per pack, which builds a default layout), or `[Name {"collation":"random|printRun|striped"}]` ([parseCardList L714][dm-parse]).
- **`[MainSlot]` is not reserved**; any sheet name works ([parseCardList][dm-parse]).
- **Order**: the doc says Settings, and CustomCards, come first, but the parser accepts sections in any order. Without layouts there must be exactly one sheet ([doc][dm-doc], [parseCardList][dm-parse]).
- **Settings**: all optional; none is required. Keys:
  - list info: `name`, `cubeCobraID` (sends draft results back to Cube Cobra).
  - display: `cardBack`, `cardTitleHeightFactor`, `showSlots`, `showSheets`.
  - session defaults: `boostersPerPlayer`, `withReplacement`, `refillWhenEmpty`, `duplicateProtection`, `colorBalance`.
  - packs: `boosterSettings`, `layouts`, `predeterminedLayouts`, `layoutWithReplacement`.

  Each key is type-checked, and unknown keys are ignored ([doc][dm-doc], [parseCardList `parseSettings`][dm-parse]).

- **No per-card metadata**: lines carry no tags, notes, or status. `[CustomCards]` objects hold name, mana_cost, type, image, rarity, set, collector_number, back, related_cards, draft_effects, and similar fields ([doc][dm-doc]).
- **Winston**: needs 2 or more human players, no bots ([Session.ts L1016][dm-session]). Piles are clamped to 2–8 (default 3) ([server.ts L786][dm-server-w]).
- **Main stack**: `boosterCount` boosters drawn from the list and shuffled together. The UI default is 3 × players ([WinstonDraft.ts][dm-winston], [WinstonDraftDialog.vue][dm-wdialog]).
- **Pack size**: cards per booster defaults to 15 and is a session setting, not a `[Settings]` key ([Session.ts L156][dm-session-cpb]). A 2-player default of 6 × 15 uses 90 cards.

```text
[Settings]
{ "name": "Max's Cube" }
[Main]
1 Abrade (SOA) 37
Grave Researcher // Reanimate
```

## Mapping to our model

| Our field                    | CC CSV                                                       | CC cubeJSON                      | CC text exports                                               | Draftmancer                           |
| ---------------------------- | ------------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------- | ------------------------------------- |
| `name`                       | lossless if non-split DFCs are written as front face only    | `details.name`                   | same name rule                                                | lossless (either form)                |
| `oracleId`                   | none; re-derived from the name                               | `details.oracle_id` via `cardID` | none                                                          | none                                  |
| `printing`                   | lossy: Set + Collector Number, then lookup                   | lossless: `cardID`               | Versions/XMage: set+number; Forge: set only; Names/MTGO: none | `(SET) Number`, then lookup           |
| `status`                     | `status` column, free string; needs a mapping (e.g. `board`) | `status`                         | none                                                          | none                                  |
| draft/prospect/cut           | best home: `board` (`mainboard`/`maybeboard`/custom board)   | boards                           | Plaintext `# board`                                           | `# maybeboard` cutoff drops prospects |
| `tags`                       | `tags` with `;` join (lossless unless a tag contains `;`)    | `tags[]`                         | none                                                          | none                                  |
| `notes`                      | `Notes` (lossless; quoted)                                   | `notes`                          | none                                                          | none                                  |
| tag defs, sections, versions | none                                                         | none                             | none                                                          | none                                  |

## Gotchas

- **DFC names**: our `name` stores `Grave Researcher // Reanimate`, but Cube Cobra only matches `Grave Researcher` (split cards are the exception). Exports to Cube Cobra must use the front face for every layout other than `split` ([convertName][cc-convertname]).
- **CSV import freezes overrides**: CMC, Type, Color, and Rarity come back as per-card overrides of Scryfall data, so emit them empty when exporting ([cubefn][cc-csvtocards]).
- **Status words differ**: Cube Cobra statuses track ownership, not design state. Map draft/prospect/cut to boards; never put them in `status` unless we pick a convention.
- **Board names**: lowercased with spaces stripped on import, so `Cut List` becomes `cutlist` ([cubefn L400][cc-csvtocards]).
- **Set codes**: the CSV writes them lowercase and text formats uppercase. Both importers match either case ([cubefn][cc-csvtocards], [parseCardList][dm-parse]).
- **Flavor names**: Cube Cobra uses `flavor_name` as the card name, so Godzilla-style printings export under the other name ([convertName][cc-convertname]).
- **Fetching**: a browser fetch from cubecobra.com only works for `cubeJSON`/`cubelist`. CSV downloads lack CORS, so they need a server-side or CLI fetch ([download.ts][cc-dl]).

[cc]: https://github.com/dekkerglen/CubeCobra/tree/3e1d63673a04229fc32a7c20ddac0983bbc0c021
[cc-dl]: https://github.com/dekkerglen/CubeCobra/blob/3e1d63673a04229fc32a7c20ddac0983bbc0c021/packages/server/src/router/routes/cube/download.ts
[cc-dl-routes]: https://github.com/dekkerglen/CubeCobra/blob/3e1d63673a04229fc32a7c20ddac0983bbc0c021/packages/server/src/router/routes/cube/download.ts#L420-L456
[cc-text]: https://github.com/dekkerglen/CubeCobra/blob/3e1d63673a04229fc32a7c20ddac0983bbc0c021/packages/server/src/serverutils/textExport.ts
[cc-csvheader]: https://github.com/dekkerglen/CubeCobra/blob/3e1d63673a04229fc32a7c20ddac0983bbc0c021/packages/server/src/serverutils/cube.ts#L20-L21
[cc-writecard]: https://github.com/dekkerglen/CubeCobra/blob/3e1d63673a04229fc32a7c20ddac0983bbc0c021/packages/server/src/serverutils/cube.ts#L259-L330
[cc-bulk]: https://github.com/dekkerglen/CubeCobra/blob/3e1d63673a04229fc32a7c20ddac0983bbc0c021/packages/server/src/serverutils/cube.ts#L150-L248
[cc-csv]: https://github.com/dekkerglen/CubeCobra/blob/3e1d63673a04229fc32a7c20ddac0983bbc0c021/packages/server/src/serverutils/csv.ts
[cc-csvtocards]: https://github.com/dekkerglen/CubeCobra/blob/3e1d63673a04229fc32a7c20ddac0983bbc0c021/packages/server/src/serverutils/cubefn.ts#L270-L428
[cc-replace]: https://github.com/dekkerglen/CubeCobra/blob/3e1d63673a04229fc32a7c20ddac0983bbc0c021/packages/server/src/router/routes/cube/bulkreplacefile.ts#L108-L112
[cc-importparse]: https://github.com/dekkerglen/CubeCobra/blob/3e1d63673a04229fc32a7c20ddac0983bbc0c021/packages/utils/src/importParsing.ts
[cc-bulkhelp]: https://github.com/dekkerglen/CubeCobra/blob/3e1d63673a04229fc32a7c20ddac0983bbc0c021/packages/client/src/components/BulkImportFormatHelp.tsx
[cc-convertname]: https://github.com/dekkerglen/CubeCobra/blob/3e1d63673a04229fc32a7c20ddac0983bbc0c021/packages/jobs/src/utils/update_cards.ts#L142-L191
[cc-ids]: https://github.com/dekkerglen/CubeCobra/blob/3e1d63673a04229fc32a7c20ddac0983bbc0c021/packages/server/src/serverutils/carddb.ts#L80-L122
[cc-catalog]: https://github.com/dekkerglen/CubeCobra/blob/3e1d63673a04229fc32a7c20ddac0983bbc0c021/packages/jobs/src/update_cards.ts#L411-L463
[cc-card]: https://github.com/dekkerglen/CubeCobra/blob/3e1d63673a04229fc32a7c20ddac0983bbc0c021/packages/utils/src/datatypes/Card.ts
[cc-cubejson]: https://github.com/dekkerglen/CubeCobra/blob/3e1d63673a04229fc32a7c20ddac0983bbc0c021/packages/server/src/router/routes/cube/api/cubeJSON.ts
[cc-cubelist]: https://github.com/dekkerglen/CubeCobra/blob/3e1d63673a04229fc32a7c20ddac0983bbc0c021/packages/server/src/router/routes/cube/api/cubelist.ts
[cc-apidocs-json]: https://github.com/dekkerglen/CubeCobra/blob/3e1d63673a04229fc32a7c20ddac0983bbc0c021/packages/client/src/pages/ApiDocsPage.tsx#L248-L345
[cc-apidocs-dl]: https://github.com/dekkerglen/CubeCobra/blob/3e1d63673a04229fc32a7c20ddac0983bbc0c021/packages/client/src/pages/ApiDocsPage.tsx#L570-L690
[cc-apidocs-rate]: https://github.com/dekkerglen/CubeCobra/blob/3e1d63673a04229fc32a7c20ddac0983bbc0c021/packages/client/src/pages/ApiDocsPage.tsx#L1043-L1090
[cc-robots]: https://github.com/dekkerglen/CubeCobra/blob/3e1d63673a04229fc32a7c20ddac0983bbc0c021/packages/server/src/static/robots.txt
[cc-tos]: https://github.com/dekkerglen/CubeCobra/blob/3e1d63673a04229fc32a7c20ddac0983bbc0c021/packages/server/src/router/routes/tos.ts#L45
[dm]: https://github.com/Senryoku/Draftmancer/tree/2c5e5ba865e9d1ef16b2eae78a940f548ad86fa8
[dm-doc]: https://github.com/Senryoku/Draftmancer/blob/2c5e5ba865e9d1ef16b2eae78a940f548ad86fa8/client/public/cubeformat.html
[dm-parse]: https://github.com/Senryoku/Draftmancer/blob/2c5e5ba865e9d1ef16b2eae78a940f548ad86fa8/src/parseCardList.ts
[dm-names]: https://github.com/Senryoku/Draftmancer/blob/2c5e5ba865e9d1ef16b2eae78a940f548ad86fa8/ManageCardData.py#L969-L975
[dm-cards]: https://github.com/Senryoku/Draftmancer/blob/2c5e5ba865e9d1ef16b2eae78a940f548ad86fa8/src/Cards.ts#L95-L170
[dm-server-cc]: https://github.com/Senryoku/Draftmancer/blob/2c5e5ba865e9d1ef16b2eae78a940f548ad86fa8/src/server.ts#L1099-L1135
[dm-ccint]: https://github.com/Senryoku/Draftmancer/blob/2c5e5ba865e9d1ef16b2eae78a940f548ad86fa8/src/cubeCobraIntegration.ts
[dm-server-w]: https://github.com/Senryoku/Draftmancer/blob/2c5e5ba865e9d1ef16b2eae78a940f548ad86fa8/src/server.ts#L776-L791
[dm-session]: https://github.com/Senryoku/Draftmancer/blob/2c5e5ba865e9d1ef16b2eae78a940f548ad86fa8/src/Session.ts#L1011-L1036
[dm-session-cpb]: https://github.com/Senryoku/Draftmancer/blob/2c5e5ba865e9d1ef16b2eae78a940f548ad86fa8/src/Session.ts#L156
[dm-winston]: https://github.com/Senryoku/Draftmancer/blob/2c5e5ba865e9d1ef16b2eae78a940f548ad86fa8/src/WinstonDraft.ts
[dm-wdialog]: https://github.com/Senryoku/Draftmancer/blob/2c5e5ba865e9d1ef16b2eae78a940f548ad86fa8/client/src/components/WinstonDraftDialog.vue
