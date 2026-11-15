# Deck list formats: import and export

Researched 2026-11-15. Card model: `packages/cube/src/schema.ts`. Printing lookups: [scryfall-api.md](scryfall-api.md).

**Source quality.** Official help pages for MTG Arena (`mtgarena-support.wizards.com`), MTGO (`help.mtgo.com`), Moxfield (`/help`), and MTGGoldfish (`/help`) returned 403 or 404 to our fetcher. Archidekt's FAQ only says the syntax sits in the Import modal under "Formatting Examples". So most facts below come from the source code of the open-source clients that read and write these formats: XMage (`magefree/mage@7da937c`) and Cockatrice (`Cockatrice/Cockatrice@50b0d2f`). Moxfield and Archidekt syntax comes from third-party sample exports and is marked **unverified**. Check those against the sites' own import dialogs before relying on them.

XM = `https://github.com/magefree/mage/blob/7da937cf57cc4dedbd93ff381e0b11c180cbe199`, CT = `https://github.com/Cockatrice/Cockatrice/blob/50b0d2ffdcac3cae7c51050e90834569383902ce`.

## MTGO

- **Official**: MTGO imports and exports a deck "as a text file or in our game-specific .dek file format". Companions go in the sideboard. The page gives no syntax ([mtgo.com deckbuilding](https://www.mtgo.com/getting-started/getting-started-deckbuilding)).
- **.txt**: one `N Name` per line. The first blank line switches to the sideboard. XMage's reader treats an empty line as the sideboard switch "like mtgo format" and warns about a second blank line ([XM TxtDeckImporter.java#L67-L75](https://github.com/magefree/mage/blob/7da937cf57cc4dedbd93ff381e0b11c180cbe199/Mage/src/main/java/mage/cards/decks/importer/TxtDeckImporter.java#L67-L75)). XMage's "MTG Online" exporter writes this text, with a blank line before the sideboard, under a `.dek` extension ([XM MtgOnlineDeckExporter.java#L16](https://github.com/magefree/mage/blob/7da937cf57cc4dedbd93ff381e0b11c180cbe199/Mage/src/main/java/mage/cards/decks/exporter/MtgOnlineDeckExporter.java#L16)).
- **.dek XML**: `<Deck>` holds `<Cards CatID Quantity Sideboard="true|false" Name Annotation/>`. Attribute order varies ([XM test testdeck.dek](https://github.com/magefree/mage/blob/7da937cf57cc4dedbd93ff381e0b11c180cbe199/Mage.Tests/src/test/data/importer/testdeck.dek)). XMage reads only `Quantity`, `Name`, and `Sideboard`, and ignores `CatID` ([XM DekDeckImporter.java](https://github.com/magefree/mage/blob/7da937cf57cc4dedbd93ff381e0b11c180cbe199/Mage/src/main/java/mage/cards/decks/importer/DekDeckImporter.java)).
- **CatID** is the MTGO catalog id of one printing. Scryfall's `/cards/collection` accepts it as `mtgo_id`.
- **Split names** use a single slash in .dek (`Refuse/Cooperate`). XMage rewrites a lone `/` to `//` ([XM DekDeckImporter.java#L31](https://github.com/magefree/mage/blob/7da937cf57cc4dedbd93ff381e0b11c180cbe199/Mage/src/main/java/mage/cards/decks/importer/DekDeckImporter.java#L31)).
- **Not carried**: tags, notes, maybeboard.

```xml
<Cards CatID="64832" Quantity="1" Sideboard="false" Name="Refuse/Cooperate" Annotation="0" />
```

## MTG Arena

- **Official**: the support article "Importing a Deck" exists ([mtgarena-support](https://mtgarena-support.wizards.com/hc/en-us/articles/360049857771-Importing-a-Deck)) but returned 403. Everything below is from XMage's Arena reader and writer.
- **Line**: `N Name (SET) num`. Set and number are optional: the pattern makes `(SET)` and `num` optional groups ([XM MtgaImporter.java#L26](https://github.com/magefree/mage/blob/7da937cf57cc4dedbd93ff381e0b11c180cbe199/Mage/src/main/java/mage/cards/decks/importer/MtgaImporter.java#L26)). The collector number can carry letters (`6p`, `6s`) ([XM testdeck.mtga](https://github.com/magefree/mage/blob/7da937cf57cc4dedbd93ff381e0b11c180cbe199/Mage.Tests/src/test/data/importer/testdeck.mtga)).
- **Sections**: a line starting `Deck` or `Mainboard` opens the main deck. `Sideboard`, `Commander`, `Maybeboard`, or a blank line opens the sideboard ([XM MtgaImporter.java#L53](https://github.com/magefree/mage/blob/7da937cf57cc4dedbd93ff381e0b11c180cbe199/Mage/src/main/java/mage/cards/decks/importer/MtgaImporter.java#L53)). XMage folds all of these into one sideboard, so that detail is XMage's, not Arena's.
- **Foil**: XMage strips a trailing `*F*` from Arena lines ([XM MtgaImporter.java#L42](https://github.com/magefree/mage/blob/7da937cf57cc4dedbd93ff381e0b11c180cbe199/Mage/src/main/java/mage/cards/decks/importer/MtgaImporter.java#L42)).
- **Set codes** can differ from paper. Arena's Dominaria is `DAR`, paper's is `DOM`. XMage maps both ways ([importer L21](https://github.com/magefree/mage/blob/7da937cf57cc4dedbd93ff381e0b11c180cbe199/Mage/src/main/java/mage/cards/decks/importer/MtgaImporter.java#L21), [exporter L21](https://github.com/magefree/mage/blob/7da937cf57cc4dedbd93ff381e0b11c180cbe199/Mage/src/main/java/mage/cards/decks/exporter/MtgArenaDeckExporter.java#L21)). Not checked: other Arena-only codes and the `A-` prefix on rebalanced cards.
- **Split names**: full `A // B` (`Expansion // Explosion (GRN) 224`). XMage's name pattern is ASCII-only ([XM CardNameUtil.java](https://github.com/magefree/mage/blob/7da937cf57cc4dedbd93ff381e0b11c180cbe199/Mage/src/main/java/mage/cards/decks/CardNameUtil.java)). Not checked: how Arena names DFCs and adventures.
- **Not carried**: tags, notes.

```text
1 Teferi, Hero of Dominaria (DAR) 207
```

## Moxfield (unverified)

- `moxfield.com/help*` returned 403. Third-party sample of a Moxfield export: `N Name (SET) num`, DFCs as the full `A // B` name, then a blank line and `SIDEBOARD:` ([silhouette-card-maker README](https://github.com/Alan-Cha/silhouette-card-maker/blob/0da09b729814aa5aafde024b5a6059624fa87951/plugins/mtg/README.md)).
- Foil `*F*` after the number, and `#tag` hashtags at the end of a line, are described only by third parties. To confirm in Moxfield's import dialog: `*E*` (etched), `#!tag` (global tags), and the `Commander`/`Maybeboard`/`Companion` headers.
- Cockatrice imports Moxfield decks by URL through the site's API, not through text ([CT importing_decks.md](https://github.com/Cockatrice/Cockatrice/blob/50b0d2ffdcac3cae7c51050e90834569383902ce/docs/doxygen/pages/user_documentation/deck_management/importing_decks.md)).

```text
2 Witch Enchanter // Witch-Blessed Meadow (MH3) 239
```

## Archidekt (unverified)

- Archidekt's FAQ points to the Import modal's "Formatting Examples" and gives no syntax itself ([archidekt.com/faq](https://archidekt.com/faq)).
- Sample exports: `1x Name (set) num *F* [Cat1,Cat2] ^Label,#hex^`. Set codes are lowercase. The number and foil are optional. `[...]` holds comma-separated categories. A special category takes flags, as in `Maybeboard{noDeck}{noPrice}`. `^Label,#color^` is a colored label, a single value per card ([magic-block archidekt-edh.txt](https://github.com/vtbassmatt/magic-block/blob/445061fc2cf53a67a88f90963bc6ae8b294c3981/examples/archidekt-edh.txt), [silhouette-card-maker README](https://github.com/Alan-Cha/silhouette-card-maker/blob/0da09b729814aa5aafde024b5a6059624fa87951/plugins/mtg/README.md)).
- Categories may contain `/` (`Rock/Dork`). DFCs are written as the full `A // B` name.
- **Carries tags**: categories are the best fit for our tags. The label can carry status.

```text
1x Austere Command (cmr) [Maybeboard{noDeck}{noPrice}]  ^Getting,#2ccce4^
```

## MTGGoldfish (unverified)

- `/help` returned 404. The deck editor page says decks import and export "to/from MTG Arena and Magic Online" and has Maindeck, Sideboard, and Maybeboard tabs ([mtggoldfish.com/decks/new](https://www.mtggoldfish.com/decks/new)). Assume it reads and writes the Arena and MTGO text above. No syntax of its own was found.

## Cockatrice .cod and text

- **.cod**: `<cockatrice_deck version="1">` with `<deckname>`, `<comments>`, `<tags><tag>`, and `<zone name="main|side|tokens|maybeboard">` ([CT deck_list.cpp#L127-L150](https://github.com/Cockatrice/Cockatrice/blob/50b0d2ffdcac3cae7c51050e90834569383902ce/libcockatrice_deck_list/libcockatrice/deck_list/deck_list.cpp#L127-L150), [CT inner_deck_list_node.h#L31-L37](https://github.com/Cockatrice/Cockatrice/blob/50b0d2ffdcac3cae7c51050e90834569383902ce/libcockatrice_deck_list/libcockatrice/deck_list/tree/inner_deck_list_node.h#L31-L37)).
- **Card**: `<card number name [setShortName] [collectorNumber] [uuid]/>`, with the optional attributes written only when set ([CT abstract_deck_list_card_node.cpp#L42-L57](https://github.com/Cockatrice/Cockatrice/blob/50b0d2ffdcac3cae7c51050e90834569383902ce/libcockatrice_deck_list/libcockatrice/deck_list/tree/abstract_deck_list_card_node.cpp#L42-L57)). `uuid` is the provider id, which Cockatrice's oracle fills from MTGJSON `scryfallId`, so it is a Scryfall printing id ([CT oracleimporter.cpp#L425](https://github.com/Cockatrice/Cockatrice/blob/50b0d2ffdcac3cae7c51050e90834569383902ce/oracle/src/oracleimporter.cpp#L425)). XMage treats a missing `number` as 1 ([XM CodDeckImporter.java](https://github.com/magefree/mage/blob/7da937cf57cc4dedbd93ff381e0b11c180cbe199/Mage/src/main/java/mage/cards/decks/importer/CodDeckImporter.java)).
- **Names**: split, aftermath, adventure, and prepare cards are one card named `A // B`. Transform, MDFC, flip, and meld faces are separate cards, each named by its face ([CT oracleimporter.cpp#L574](https://github.com/Cockatrice/Cockatrice/blob/50b0d2ffdcac3cae7c51050e90834569383902ce/oracle/src/oracleimporter.cpp#L574), [L617](https://github.com/Cockatrice/Cockatrice/blob/50b0d2ffdcac3cae7c51050e90834569383902ce/oracle/src/oracleimporter.cpp#L617)). So a DFC must be exported by its front face. On import, `/`, `|`, or `//` all become `//`, and a `(Transform)` suffix is cut off ([CT card_name_normalizer.cpp#L40-L45](https://github.com/Cockatrice/Cockatrice/blob/50b0d2ffdcac3cae7c51050e90834569383902ce/libcockatrice_card/libcockatrice/card/import/card_name_normalizer.cpp#L40-L45)).
- **Text import**: `[qty] Name [options]`. The quantity can be `2`, `2x`, or `2X`. Options: `(SET) 123` and `*F*`. Lines may start with `SB:`. The first blank line divides main from side ([CT importing_decks.md](https://github.com/Cockatrice/Cockatrice/blob/50b0d2ffdcac3cae7c51050e90834569383902ce/docs/doxygen/pages/user_documentation/deck_management/importing_decks.md)). In code, the set must be 3+ word characters and the number must start with a digit (`\((\w{3,})\)\s+(\d+[^\w\s]*)`). A `Sideboard` line or `Deck`/`Mainboard` header is also understood. Text lines before the first card become the deck name and comments ([CT deck_list_plain_text_parser.cpp#L29-L40](https://github.com/Cockatrice/Cockatrice/blob/50b0d2ffdcac3cae7c51050e90834569383902ce/libcockatrice_deck_list/libcockatrice/deck_list/deck_list_plain_text_parser.cpp#L29-L40)).
- **Text export**: `N Name`, with an optional `SB:` prefix. The maybeboard "is scratch space and never exported" ([CT deck_list.cpp#L326-L355](https://github.com/Cockatrice/Cockatrice/blob/50b0d2ffdcac3cae7c51050e90834569383902ce/libcockatrice_deck_list/libcockatrice/deck_list/deck_list.cpp#L326-L355)).
- **Carries**: deck-level tags and comments only. Nothing per card.

```xml
<card number="12" name="Forest"/>
```

## XMage .dck

- **Line**: `[SB: ]N [SET:num] Name` ([XM XmageDeckExporter.java#L57-L60](https://github.com/magefree/mage/blob/7da937cf57cc4dedbd93ff381e0b11c180cbe199/Mage/src/main/java/mage/cards/decks/exporter/XmageDeckExporter.java#L57-L60)). The reader's pattern requires the `[SET:num]` part ([XM DckDeckImporter.java#L24](https://github.com/magefree/mage/blob/7da937cf57cc4dedbd93ff381e0b11c180cbe199/Mage/src/main/java/mage/cards/decks/importer/DckDeckImporter.java#L24)). Numbers can carry `*` or `+` (`[WAR:2*]`, `[ODY:72+]`).
- **Other lines**: `NAME:` and `AUTHOR:` headers. `LAYOUT MAIN:(rows,cols)(settings)|([SET:n],...)...` records the deck editor's card grid. `#` starts a comment line ([XM DckDeckImporter.java#L39-L139](https://github.com/magefree/mage/blob/7da937cf57cc4dedbd93ff381e0b11c180cbe199/Mage/src/main/java/mage/cards/decks/importer/DckDeckImporter.java#L39-L139), [XM testdeck.dck](https://github.com/magefree/mage/blob/7da937cf57cc4dedbd93ff381e0b11c180cbe199/Mage.Tests/src/test/data/importer/testdeck.dck)). If the number and name disagree, the name wins and XMage re-resolves the printing.
- **Set codes** are XMage's own, mostly the same as paper (the Arena exporter turns `DOM` into `DAR`).
- **Names**: split is `Fire // Ice`. A DFC uses its front face (`Delver of Secrets`), and a back ("night") card is rejected ([XM DckDeckImporter.java#L104](https://github.com/magefree/mage/blob/7da937cf57cc4dedbd93ff381e0b11c180cbe199/Mage/src/main/java/mage/cards/decks/importer/DckDeckImporter.java#L104)). An adventure card uses only its main name (`Bonecrusher Giant`) ([XM ThroneOfEldraine.java](https://github.com/magefree/mage/blob/7da937cf57cc4dedbd93ff381e0b11c180cbe199/Mage.Sets/src/mage/sets/ThroneOfEldraine.java), [XM Apocalypse.java](https://github.com/magefree/mage/blob/7da937cf57cc4dedbd93ff381e0b11c180cbe199/Mage.Sets/src/mage/sets/Apocalypse.java)).
- **XMage .txt reader**: a `//sideboard` comment switches to the sideboard. `#` starts an inline comment (`2 Blinding Fog #some text`, called the deckstats style). `SB:` works per line. A lone `/` becomes `//` ([XM TxtDeckImporter.java#L48-L125](https://github.com/magefree/mage/blob/7da937cf57cc4dedbd93ff381e0b11c180cbe199/Mage/src/main/java/mage/cards/decks/importer/TxtDeckImporter.java#L48-L125)). This clashes with Moxfield-style `#tag`.

```text
SB: 3 [ZNR:315] Archon of Emeria
```

## Tolerant parser

Process one line at a time, in this order. Each step strips what it matches from the line.

1. Trim and normalize: curly `’` to `'`, `Æ` to `Ae`, tabs to spaces. Skip blank lines, but track them for the blank-line rule.
2. **Header**, matched case-insensitively against the whole line: `^(//\s*)?(deck|main(deck|board)?|sideboard|side|maybe(board)?|commanders?|companion|considering|tokens)\s*:?\s*$`. It sets the current section. A `Name:` or `About` header is metadata.
3. **Comment**: `^(//|#)` with no digit after it. Skip the line.
4. **Prefix**: `^SB:\s*` marks this line as sideboard.
5. **Quantity**: `^(\d+)\s*[xX]?\s+`. With no quantity, the count is 1.
6. **XMage printing**: `^\[([^\]:]+):([^\]]+)\]\s*` captures set and number.
7. **Trailers**, repeated from the right:
   - `\s+\^([^,^]+)(,#[0-9a-f]{6})?\^$` is a label.
   - `\s+\[([^\]]+)\]$` is a category list. Split it on `,` and take each `{flag}` off the category name.
   - `(\s+#[!\w-]+)+$` are tags.
   - `\s+\*(F|E)\*$` is a finish.
8. **Arena printing**: `\s+\(([A-Za-z0-9]{2,6})\)(\s+([A-Za-z0-9★†*+-]+))?$` captures set and number. A bare `(SET)` is valid (Archidekt).
9. What is left is the name. Change `/`, `/`, or `|` to `//` only when the result resolves as a name. Cut off a `(Transform)` suffix.

Sections: a blank line moves main to side only once, only if no header was seen, and only after at least one card line (the XMage and Cockatrice rule). `SB:`, a header, and an Archidekt `Sideboard`/`Maybeboard` category each override the blank-line rule.

Ambiguities:

- **`#`**: the XMage .txt reader treats it as a comment, Moxfield as a tag. Take it as a tag only when the whole tail is `#word` tokens.
- **Brackets**: `[ZNR:177]` (XMage printing) is not a category. A colon inside the brackets tells them apart. Cockatrice also accepts a bare `[SET]` prefix, and the quantity regex skips leading brackets (`reMultiplier`).
- **Parentheses in names**: some names carry their own parentheses (Un-cards). Cockatrice notes three such cards. Match `(SET)` only at the end, or before a number.
- **Name-only lines** (no quantity, no set) can't be told apart from a free-text title or comment line. Cockatrice treats leading text lines as the deck name and comments.
- **Section headers**: `Commander` folds into the sideboard in XMage, but it is its own zone in Moxfield and Archidekt. `Maybeboard` folds into the sideboard in XMage, while Cockatrice keeps it and never exports it.
- **Collector numbers** can be `6p`, `2*`, `72+`, or `PLST`'s `SET-123`.
- **Two names on one line**: `A // B` can be one card, or two cards written as two lines. The full Scryfall name is needed to resolve it.

## Mapping to our model

| Our field       | MTGO txt/.dek                    | Arena                            | Moxfield                | Archidekt                          | Cockatrice .cod                        | XMage .dck                          |
| --------------- | -------------------------------- | -------------------------------- | ----------------------- | ---------------------------------- | -------------------------------------- | ----------------------------------- |
| name            | name; .dek uses `A/B`            | name                             | full `A // B`           | full `A // B`                      | DFC front face; split/adventure full   | DFC front face; adventure main name |
| oracleId        | resolve by name                  | resolve by name                  | resolve by name         | resolve by name                    | resolve by name                        | resolve by name                     |
| printing        | .dek `CatID` (mtgo_id, lossless) | `(SET) num` (Arena codes, lossy) | `(SET) num`             | `(set) num`                        | `uuid` = Scryfall id (lossless)        | `[SET:num]` (XMage codes)           |
| status draft    | main                             | Deck                             | main                    | main (no special category)         | zone main                              | main                                |
| status prospect | sideboard                        | Sideboard                        | Maybeboard (unverified) | `Maybeboard{noDeck}{noPrice}`      | zone maybeboard (text export drops it) | `SB:`                               |
| status cut      | omit or sideboard (lossy)        | omit                             | omit                    | custom `Cut{noDeck}` category      | omit                                   | omit                                |
| tags            | lost                             | lost                             | `#tag` (unverified)     | `[...]` categories (round-trips)   | lost (deck-level `<tags>` only)        | lost                                |
| notes           | lost                             | lost                             | lost                    | lost; `^label^` is one short value | lost (deck `<comments>` only)          | lost                                |
| quantity        | count                            | count                            | count                   | count                              | `number`                               | count                               |

- **Round-trips best**: Archidekt (status, through categories; tags; printing by set and number) and Cockatrice .cod (status through zones; exact printing through `uuid`).
- **Lossy everywhere**: notes, our `source` provenance, and `cut` as a separate state from "not in the cube".
- **Quantity**: a cube is singleton, so on import a quantity above 1 is a warning, not copies.

## Gotchas

- **Export names per target**: front face only for Cockatrice and XMage DFCs. Main name only for XMage adventures. Full `A // B` for split cards everywhere. `A/B` in MTGO .dek.
- **Arena set codes differ from paper** (`DAR`/`DOM`). Prefer the printing's Scryfall id, or `mtgo_id` for .dek. Don't trust set and number across Arena and paper.
- **XMage's "MTG Online" exporter writes plain text with a `.dek` extension**. Check the file content, not the extension.
- **Cockatrice's set regex wants 3+ characters**: two-character codes in `(XX) 1` stay part of the name.
- **Cockatrice drops the maybeboard on text export**. Use .cod to keep prospects.
- **ASCII**: XMage's Arena pattern only accepts ASCII names, so accents (`Lim-Dûl`) and `Æ` must be normalized.
- **Re-check**: Moxfield, Archidekt, and Arena syntax should be checked against each site's import dialog before shipping. Their help pages were not reachable for this research.
