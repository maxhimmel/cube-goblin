import { describe, expect, it } from "vitest";
import { displayFields } from "./card.ts";
import type { Card } from "./schemas.ts";

const images = { small: "s.jpg", large: "l.jpg" };

const base: Card = {
  object: "card",
  id: "1",
  name: "Front // Back",
  layout: "transform",
  color_identity: ["G", "U"],
  rarity: "rare",
  set: "tst",
  collector_number: "1",
  scryfall_uri: "https://scryfall.com/card/tst/1",
  cmc: 2,
  card_faces: [
    { name: "Front", mana_cost: "{1}{G}", colors: ["G"], image_uris: images },
    { name: "Back", colors: ["U"], image_uris: images },
  ],
};

describe("displayFields", () => {
  it("takes a double-faced card's colors from its front face", () => {
    expect(displayFields(base)?.colors).toEqual(["G"]);
  });

  it("prefers top-level colors when Scryfall gives them", () => {
    expect(displayFields({ ...base, colors: ["G", "R"] })?.colors).toEqual(["G", "R"]);
  });
});
