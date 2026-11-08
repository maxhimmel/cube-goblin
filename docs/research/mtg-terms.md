# MTG terms: research notes

Researched 2026-11-08. Canonical definitions live in [GLOSSARY.md](../GLOSSARY.md); this file covers where sources disagree and open questions.

## Winston draft: variants

- **Pool size**: 90 random cube cards ([mtg.wiki](https://mtg.wiki/page/Winston_Draft)); 45 per player ([Cube Cobra](https://cubecobra.com/cube/overview/11z62)); some forums say 55–60 per player ([MTG Salvation](https://www.mtgsalvation.com/forums/the-game/the-cube-forum/articles-podcasts-and-guides/576611-cubing-with-two-a-guide-to-two-player-draft)). This cube's size: `cube.config.json`.
- **Players**: best with two, works with up to four.
- **Booster version**: six packs opened and shuffled into one stack.
- **Hareruya variant**: flip 8 cards, active player splits them into two piles of any sizes, opponent picks one, rest discarded. A different format, not Winston ([Hareruya](https://article.hareruyamtg.com/article/?p=219)).
- **Visibility**: piles face down, seen only by the player whose turn it is.

Other sources:

- [Card Kingdom](https://blog.cardkingdom.com/winston-draft-101/)
- [Draftsim](https://draftsim.com/mtg-winston-draft/)
- [Cardmarket](https://cardmarket.com/en/Insight/Articles/The-Amazing-Winston-Draft-Format)

## Cube terms

- No official glossary; definitions are community ones (Cube Cobra, Draftsim, MTG Salvation, StarCityGames).
- **Cross-pollination**: comes from a single cube's glossary, not general usage. Adopted.
- **Combo**: no canonical definition ([StarCityGames](https://articles.starcitygames.com/premium/eternal-europe-fundamentals-what-is-combo/)). An older MTG Salvation wiki entry used a looser one: any two or more cards giving an advantage ([TappedOut quote](https://tappedout.net/mtg-forum/challenges-and-articles/what-the-heck-does-combo-actually-mean)). Reanimator is only one combo type. The glossary sorts combos by type: infinite loop, infinite resource, instant win, lock, cheat into play, storm. That split follows community taxonomies, which differ on details: mtgpics separates "lock (does not kill)" from "near-win" ([mtgpics](https://mtgpics.com/combos/classification)), and casualplaneswalker lists infinite, storm, value/lock, and alternate win ([casualplaneswalker](https://casualplaneswalker.com/wiki/combo/)). "Cheat into play" isn't a named category in those sources; it's our grouping for reanimator, Sneak Attack, and Show and Tell. Card text checked against the Scryfall API on 2026-11-08. For combo in cube design: [Hipsters of the Coast](https://www.hipstersofthecoast.com/2015/06/drawing-live-cube-design-what-is-combo-part-2/).
