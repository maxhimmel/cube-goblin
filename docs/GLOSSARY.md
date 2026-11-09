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

## Mana value

The total amount of mana in a card's mana cost, regardless of color; X counts as 0. A card with no mana cost, such as a land, has mana value 0. A split card adds up both halves. A double-faced card uses its front face. It replaced the older term "converted mana cost". Scryfall's `cmc` field holds it. ([Comprehensive Rules 202.3](https://media.wizards.com/2026/downloads/MagicCompRules%2020261106.txt))

## Color

A card is the colors of the mana symbols in its mana cost (white, blue, black, red, green), plus any color set by a color indicator or a characteristic-defining ability (so Dryad Arbor is green, and a devoid card is colorless). Scryfall's `colors` field holds the result. **Monocolored** means exactly one color, **multicolored** two or more, and **colorless** none. Multicolored is not itself a color. A double-faced card has its front face's colors outside the battlefield and stack. Color is not color identity, which also counts mana symbols in rules text. ([Comprehensive Rules 105.2, 204, 712.6a](https://media.wizards.com/2026/downloads/MagicCompRules%2020261106.txt))
