import { describe, expect, it } from "vitest";
import { displayFields, printingLabels } from "./card.ts";
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

  it("reads power and toughness from the card, or else its front face", () => {
    expect(displayFields({ ...base, power: "2", toughness: "3" })).toMatchObject({
      power: "2",
      toughness: "3",
    });
    const faces = [
      { ...base.card_faces?.[0], name: "Front", power: "*", toughness: "1+*" },
      { name: "Back", image_uris: images },
    ];
    expect(displayFields({ ...base, card_faces: faces })).toMatchObject({
      power: "*",
      toughness: "1+*",
    });
    expect(displayFields(base)).not.toHaveProperty("power");
  });

  it("prefers top-level colors when Scryfall gives them", () => {
    expect(displayFields({ ...base, colors: ["G", "R"] })?.colors).toEqual(["G", "R"]);
  });
});

describe("printingLabels", () => {
  it("names the frame, border, and special printings a player would recognize", () => {
    expect(
      printingLabels({
        ...base,
        set: "spg",
        border_color: "borderless",
        frame_effects: ["showcase", "extendedart", "legendary"],
        full_art: true,
      }),
    ).toEqual(["borderless", "showcase", "extended art", "full art", "special guest"]);
    expect(printingLabels({ ...base, frame: "1993", promo_types: ["sldbonus"] })).toEqual([
      "retro frame",
      "bonus",
    ]);
    expect(printingLabels(base)).toEqual([]);
  });
});
