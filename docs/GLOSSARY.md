# Glossary

Canonical terms for this project. One entry per term, each with a source. How to add terms: [CLAUDE.md](../CLAUDE.md). Notes and disagreements: [research/mtg-terms.md](research/mtg-terms.md). Card text comes from [Scryfall](https://scryfall.com).

## Cube

A custom draft environment built from existing Magic cards and curated by its designer. Size and format: `cube.config.json`. ([Draftsim](https://draftsim.com/mtg-cube/))

## Singleton

The cube has one copy of each card, with no exceptions. ([Riptide Lab](https://riptidelab.com/cube-academy/breaking-singleton/))

## Winston draft

A two-player draft. Cards are dealt from a face-down main stack into three piles. On your turn you look at pile 1. Either take it, or put it back with one new card from the stack added and move on to the next pile. If you pass all three piles, you take the top card of the stack. A pile you take restarts with one card. ([mtg.wiki](https://mtg.wiki/page/Winston_Draft), [Card Kingdom](https://blog.cardkingdom.com/winston-draft-101/))

## Archetype

A deck strategy, built on shared synergies, that the cube supports. ([MTG Salvation](https://www.mtgsalvation.com/forums/the-game/the-cube-forum/articles-podcasts-and-guides/573818-a-comprehensive-list-of-cube-archetypes))

## Tag

A label on a card. A card can carry many tags. Every tag has a kind, either **archetype** (see [Archetype](#archetype)) or **group** (see [Group](#group)). The allowed tags, and their labels, live in `cube/tags.json`. Cube Cobra also gives each card a free-form list of tags and can sort a cube by tag; the fixed vocabulary and the kinds are this project's additions. ([Cube Cobra `Card.ts`](https://github.com/dekkerglen/CubeCobra/blob/303e70743a787bb93d22893c2c6c2e9bb33e626a/packages/utils/src/datatypes/Card.ts#L281), [Cube Cobra `Sort.ts`](https://github.com/dekkerglen/CubeCobra/blob/303e70743a787bb93d22893c2c6c2e9bb33e626a/packages/utils/src/sorting/Sort.ts#L630))

## Group

A project-defined term with no outside source: a tag of kind `group`, meaning a set of cards the designer wants to see together that isn't an archetype, such as removal or card draw. Groups can overlap. See [Tag](#tag).

## Section

A project-defined term with no outside source: a named box on the workbench Board that holds cards while the designer sketches a [Group](#group) or [Archetype](#archetype) before tagging. A card can sit in several sections. Sections live in `cube/board.json`, apart from tags. A section has its own name and links any number of [Tags](#tag); applying them adds every linked tag to every card in the section ([T-023](tickets/T-023-section-tags.md)). Not the same as a bucket in Insights, which is one bar or cell of a chart. Called a bin until [T-018](tickets/T-018-sections-on-the-board.md); before that, "section" was a card field naming the deck a card was imported from, now a `Deck: <name>` line in its notes.

## Enabler / payoff

An **enabler** produces an effect or resource. A **payoff** turns it into value. Synergy and combo are both built from these two parts.

## Synergy

An enabler does its normal job and a payoff triggers from it, so the link is easy to see. Each card is fine on its own; together they're better. ([Draftsim](https://draftsim.com/mtg-how-to-build-a-cube/))

| Enabler                                                                                       | Payoff                                                                                                                               | Result                                     |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| [Raise the Alarm](https://scryfall.com/card/j25/101/raise-the-alarm): create two 1/1 Soldiers | [Impact Tremors](https://scryfall.com/card/fdn/717/impact-tremors): 1 damage to each opponent whenever a creature you control enters | 2 tokens plus 2 damage                     |
| [Lightning Bolt](https://scryfall.com/card/msc/806/lightning-bolt): any instant or sorcery    | [Young Pyromancer](https://scryfall.com/card/tdc/95/young-pyromancer): a 1/1 Elemental whenever you cast an instant or sorcery       | Removal plus a body                        |
| [Carrion Feeder](https://scryfall.com/card/mh1/81/carrion-feeder): sacrifice a creature       | [Blood Artist](https://scryfall.com/card/soc/209/blood-artist): drain 1 whenever a creature dies                                     | Each sacrifice grows the Feeder and drains |

## Combo

A small set of cards, usually 2–3, whose interaction does far more than the cards do separately. It loops, locks the opponent, wins outright, or breaks the mana curve, and often ends the game on the spot. Pieces are often weak or blank alone. That's the contrast with synergy, where each card stands on its own and the bonus is incremental. ([mtg.wiki](https://mtg.wiki/page/Combos), [casualplaneswalker](https://casualplaneswalker.com/wiki/combo/), [mtgpics classification](https://mtgpics.com/combos/classification))

An infinite resource (mana, tokens) is not a win by itself; it needs a **finisher**. A loop of only mandatory actions draws the game ([mtg.wiki: Loop](https://mtg.wiki/page/Loop)).

| Type                             | Cards                                                                                                                                                                                                                     | What happens                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Infinite loop**                | [Splinter Twin](https://scryfall.com/card/mm2/129/splinter-twin) on [Pestermite](https://scryfall.com/card/j25/343/pestermite)                                                                                            | Each hasty token copy's enter trigger untaps the original: infinite hasty fliers         |
| **Infinite loop**                | [Saheeli Rai](https://scryfall.com/card/kld/186/saheeli-rai) + [Felidar Guardian](https://scryfall.com/card/aer/19/felidar-guardian)                                                                                      | Copy the Guardian, which blinks Saheeli and resets her loyalty: infinite hasty Cats      |
| **Infinite loop**                | [Exquisite Blood](https://scryfall.com/card/lcc/195/exquisite-blood) + [Sanguine Bond](https://scryfall.com/card/c21/153/sanguine-bond)                                                                                   | Any life loss or gain starts a drain/gain cycle that never stops                         |
| **Infinite loop**                | [Heliod, Sun-Crowned](https://scryfall.com/card/cmm/29/heliod-sun-crowned) + [Walking Ballista](https://scryfall.com/card/2xm/306/walking-ballista)                                                                       | Give Ballista lifelink; each ping gains life, which adds a counter back: infinite damage |
| **Infinite resource**            | [Devoted Druid](https://scryfall.com/card/ecc/104/devoted-druid) + [Vizier of Remedies](https://scryfall.com/card/akh/38/vizier-of-remedies)                                                                              | Untap for free forever: infinite {G}, which still needs a finisher                       |
| **Instant win**                  | [Thassa's Oracle](https://scryfall.com/card/thb/73/thassas-oracle) + [Demonic Consultation](https://scryfall.com/card/me2/85/demonic-consultation)                                                                        | Name a card not in your deck, exile your whole library, then Oracle's trigger wins       |
| **Instant win**                  | [Painter's Servant](https://scryfall.com/card/shm/257/painters-servant) + [Grindstone](https://scryfall.com/card/tpr/223/grindstone)                                                                                      | Every card shares a color, so Grindstone mills the opponent's whole library              |
| **Lock**                         | [Isochron Scepter](https://scryfall.com/card/2xm/264/isochron-scepter) + [Orim's Chant](https://scryfall.com/card/mh3/265/orims-chant)                                                                                    | Cast Chant free every turn: the opponent can't cast spells                               |
| **Cheat into play**              | [Sneak Attack](https://scryfall.com/card/dmr/139/sneak-attack) or [Show and Tell](https://scryfall.com/card/cn2/121/show-and-tell) + [Emrakul, the Aeons Torn](https://scryfall.com/card/2x2/1/emrakul-the-aeons-torn)    | Put a 15-drop onto the battlefield for a few mana                                        |
| **Cheat into play** (reanimator) | [Entomb](https://scryfall.com/card/dmr/82/entomb) [Griselbrand](https://scryfall.com/card/inr/115/griselbrand) + [Reanimate](https://scryfall.com/card/dsc/155/reanimate)                                                 | An 8-drop for 2 mana; lifelink and "pay 7: draw 7" pay back the life                     |
| **Cheat into play** (reanimator) | [Faithless Looting](https://scryfall.com/card/soc/244/faithless-looting) away [Archon of Cruelty](https://scryfall.com/card/frc/47/archon-of-cruelty) + [Unburial Rites](https://scryfall.com/card/2x2/95/unburial-rites) | An 8-drop for 5 mana total, with its enter trigger                                       |
| **Storm**                        | [Dark Ritual](https://scryfall.com/card/msc/793/dark-ritual) and other cheap spells + [Grapeshot](https://scryfall.com/card/msc/803/grapeshot)                                                                            | Chain spells in one turn; Grapeshot copies itself once per earlier spell                 |

## Cross-pollination

Two archetypes share some cards or traits, so one deck can draw on both. ([Cube Cobra](https://cubecobra.com/cube/overview/archetypes))

## Redundancy

Several similar cards in a singleton cube, so an archetype shows up consistently. ([StarCityGames](https://articles.starcitygames.com/magic-the-gathering/how-to-build-an-mtg-cube-with-redundancy-in-mind/))

## Overlap

The cards that carry exactly one combination of the tags picked in the Tags view: every picked tag in the combination, and none of the others. Each card falls in one overlap only, and "none of these" is an overlap too. This is how UpSet reads its rows ("shared by sets A and B, but not with C"), and it is one region of a Venn diagram. UpSet suggests a Venn diagram for fewer than four sets and its matrix of combinations beyond that. In code: `tagOverlaps` (`packages/cube/src/overlaps.ts`). ([UpSet](https://upset.app/))

## Filter

A saved, named set of conditions that picks cards out of the cube. Cube Cobra uses the same word for the parsed search terms its cube views check each card against ("converts them to a filter object, which can be used to check if a card matches all of the filters within"). Here a filter is a query written in a Scryfall-style syntax (`t:creature pow>=3 -c:g`): terms AND together (an explicit `and` is allowed and changes nothing; `and` binds tighter than `or`, as in Cube Cobra), `or` and parentheses group, `-` negates. Every Insights [bucket](tickets/T-016-insights-drill-down.md) has an equivalent query, so a chart click becomes a filter. A filter whose query names a status (`is:draft`) counts the whole cube; otherwise it counts the page's scope. Filters live in `cube/filters.json` and show as blocks on Insights ([T-027](tickets/T-027-filter-widgets.md), [T-028](tickets/T-028-filter-query-syntax.md)). Not the Wall's tag filter (`?with=&without=`), which is not saved. In code: `compileQuery` (`packages/cube/src/query.ts`), `filterCards` (`packages/cube/src/filters.ts`). ([Cube Cobra parser docs](https://github.com/dekkerglen/CubeCobra/blob/master/packages/docs/parser.md), [Scryfall syntax](https://scryfall.com/docs/syntax))

## Lab

A project-defined term with no outside source: the workbench view (`#/lab`) that puts the cards in contention, charts, and filter blocks in one layout the user arranges, where applied filters change the cards and charts at once ([T-031](tickets/T-031-lab-view.md)). Not the Board, which sketches [sections](#section).

## Layout

A project-defined term with no outside source: a named snapshot of the [Lab](#lab)'s settings (dock blocks and their scopes, grouping, card layout, switches, and applied filters), saved to `cube/layouts.json` to switch between setups. The Lab remembers its current settings without one ([T-031](tickets/T-031-lab-view.md)). Not an Insights dashboard layout, which stays in the browser ([T-015](tickets/T-015-insights-dashboard-layout.md)).

## Version

A project-defined term with no outside source: a named, dated snapshot of the whole cube (every card with its status, tags, notes, and printing, plus the tag list and Board [sections](#section)), saved to `cube/versions/<date>-<label>.json` from the workbench's Versions view. Comparing two versions, or one with the current cube, lists what changed ([T-014](tickets/T-014-versions-and-compare.md)). Not a git commit, though version files are committed like other cube data.

## Printing

One release of a card in a particular set, with its own collector number, art, frame, and border. A card that appears again in a later set is a reprint, so one card can have many printings: alternate art, borderless, showcase, Special Guests, and so on. Scryfall gives each printing its own ID and lists them with `unique=prints`. Each cube card stores the printing it shows in `printing`. ([mtg.wiki](https://mtg.wiki/page/Reprint), [Scryfall](https://scryfall.com/docs/api/cards/search)) Notes: [research/scryfall-api.md](research/scryfall-api.md#printings).

## Mana value

The total amount of mana in a card's mana cost, regardless of color; X counts as 0. A card with no mana cost, such as a land, has mana value 0. A split card adds up both halves. A double-faced card uses its front face. It replaced the older term "converted mana cost". Scryfall's `cmc` field holds it. ([Comprehensive Rules 202.3](https://media.wizards.com/2026/downloads/MagicCompRules%2020261106.txt))

## Color

A card is the colors of the mana symbols in its mana cost (white, blue, black, red, green), plus any color set by a color indicator or a characteristic-defining ability (so Dryad Arbor is green, and a devoid card is colorless). Scryfall's `colors` field holds the result. **Monocolored** means exactly one color, **multicolored** two or more, and **colorless** none. Multicolored is not itself a color. A double-faced card has its front face's colors outside the battlefield and stack. Color is not color identity, which also counts mana symbols in rules text. ([Comprehensive Rules 105.2, 204, 712.6a](https://media.wizards.com/2026/downloads/MagicCompRules%2020261106.txt))

## Pip

An informal term for a non-generic mana symbol in a card's mana cost, counted to judge how hard the cost is on a mana base: Invoke the Winds' four blue pips are harder to cast than Mind Control's two. A hybrid symbol counts as a pip of each of its colors. **Heavy pips** (project term): two or more pips of one color on one face, like `{R}{R}`. **Color presence** (project term): the cards of a color, where a multicolored card counts for each of its colors. ([mtg.wiki](https://mtg.wiki/page/Mana_cost#Description))

## Oracle tag

A community tag from Scryfall's Tagger project that describes what a card does, such as removal, ramp, or draw. Tags form a tree; a parent tag covers every card under its children. Searchable on Scryfall as `otag:` or `function:`. Not the same as a [Tag](#tag), which the designer sets. ([Scryfall tags](https://scryfall.com/docs/api/tags), [syntax](https://scryfall.com/docs/syntax)) Notes: [research/oracle-tags.md](research/oracle-tags.md).

## Function

What a card does for a deck, such as removal, ramp, or card draw. A function is not separate data: it is an ordinary [Tag](#tag) of kind group (see [Group](#group)), and the designer can rename, re-kind, or remove it like any other tag. Scryfall fills function tags in: `pnpm cube tag-functions` adds them to every card once, and `#/add` adds them to each new card. Each function reads one [Oracle tag](#oracle-tag) and its children; fixing also counts a card whose Scryfall `produced_mana` lists two or more colors. The list, with each oracle tag id, lives in `CARD_FUNCTIONS` (`packages/cube/src/functions.ts`). Definitions of the main ones: [removal](https://mtg.wiki/page/Removal), [board wipe](https://mtg.wiki/page/Board_wipe), [counterspell](<https://mtg.wiki/page/Counter_(keyword_action)>), [ramp](https://mtg.wiki/page/Mana_acceleration), [card draw](https://mtg.wiki/page/Draw), [fixing](https://mtg.wiki/page/Mana_fixing), [tutor](https://mtg.wiki/page/Tutor), [reanimate](https://mtg.wiki/page/Reanimation), [mill](https://mtg.wiki/page/Mill), [evasion](https://mtg.wiki/page/Evasion_ability), [combat trick](https://mtg.wiki/page/Combat_trick).
