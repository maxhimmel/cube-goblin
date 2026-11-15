export const AI_IMPORT_EXAMPLE = `Deck
1 Lightning Bolt (M10) 146 [Red, Removal]
1 Fire // Ice [Red, Blue]
Maybeboard
1 Counterspell [Blue]
Cut:
1 Llanowar Elves`;

export const AI_IMPORT_PROMPT = `Convert my Magic: The Gathering cube list (below) into this exact format so I can import it into a cube app.

Format rules:
- One card per line, written as "1 Card Name". Always 1, even if my list says more copies.
- Use each card's exact English name as Scryfall spells it. Fix typos and nicknames ("bolt" means "Lightning Bolt") only when you are sure which card I mean. For double-faced, split, and adventure cards, write both halves joined by " // ", like "Fire // Ice".
- Put cards under these headings, each heading on its own line:
  - "Deck" for cards in the cube.
  - "Maybeboard" for cards I'm considering or unsure about.
  - "Cut:" for cards I've removed.
  Leave out a heading that has no cards. If my list doesn't say, put every card under "Deck".
- If my list sorts cards into my own groups (colors, archetypes, roles like removal), keep each card's groups as tags in square brackets at the end of its line, separated by commas: "1 Lightning Bolt [Red, Removal]".
- If my list names a card's set or printing, add it right after the name as "(SET) number", like "1 Lightning Bolt (M10) 146". Otherwise leave it out.
- Leave out everything that isn't a card: my own headings, counts, notes, prices, and blank lines.
- If you can't tell which card a line means, keep my text as the name; the app will ask me about it.
- Reply with only the converted list inside one code block, nothing else.

Example of the format:
${AI_IMPORT_EXAMPLE}

My list:
`;
