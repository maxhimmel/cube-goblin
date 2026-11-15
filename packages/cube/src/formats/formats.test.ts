import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { csvCell, parseCsv } from "./markup.ts";
import type { CardStatus } from "../schema.ts";
import {
  EXPORT_FORMATS,
  boardStatus,
  detectFormat,
  exportFormat,
  exportName,
  formatLosses,
  nameCandidates,
  parseList,
} from "./index.ts";
import type { ExportCard, ImportRow } from "./index.ts";
import { parseCardLine } from "./text.ts";

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");

const CARDS: ExportCard[] = [
  {
    name: "Abrade",
    layout: "normal",
    status: "draft",
    set: "soa",
    collectorNumber: "37",
    printingId: "c5bb5307-e874-42c4-b85d-06b9f6c474c8",
    mtgoId: 123_456,
    tags: ["Removal", "Burn"],
    notes: 'Says "deal 3", fine; keep',
  },
  {
    name: "Fire // Ice",
    layout: "split",
    status: "draft",
    set: "mh2",
    collectorNumber: "290",
    tags: ["Removal"],
    notes: "",
  },
  {
    name: "Grave Researcher // Reanimate",
    layout: "transform",
    status: "prospect",
    set: "eoc",
    collectorNumber: "12",
    tags: [],
    notes: "=maybe",
  },
  {
    name: "Bonecrusher Giant // Stomp",
    layout: "adventure",
    status: "draft",
    tags: ["Value"],
    notes: "",
  },
  {
    name: "Llanowar Elves",
    layout: "normal",
    status: "cut",
    set: "dom",
    collectorNumber: "168",
    tags: ["Ramp"],
    notes: "too fast",
  },
];

const META = { name: "Max's Cube", size: { min: 90, max: 100 } };

const BY_NAME = new Map<string, ExportCard>();
for (const card of CARDS) {
  BY_NAME.set(card.name, card);
  BY_NAME.set(card.name.split(" // ")[0] ?? card.name, card);
}

function resolve(row: ImportRow): ExportCard | undefined {
  return nameCandidates(row.name)
    .map((candidate) => BY_NAME.get(candidate))
    .find((card) => card !== undefined);
}

function statusOf(row: ImportRow): CardStatus | "skip" {
  return boardStatus(row.board);
}

describe("round trip", () => {
  for (const format of EXPORT_FORMATS) {
    it(`${format.id} re-imports the cards and fields it carries`, () => {
      const text = format.write(CARDS, META);
      const parsed = parseList(text);
      const expected = CARDS.filter(
        (card) =>
          card.status === "draft" ||
          (card.status === "prospect" && format.carries.prospect) ||
          (card.status === "cut" && format.carries.cut),
      );
      const resolved = parsed.rows.map((row) => resolve(row)?.name);
      expect(resolved.toSorted()).toEqual(expected.map((card) => card.name).toSorted());
      parsed.rows.forEach((row) => {
        const card = resolve(row);
        if (card === undefined) {
          throw new Error("missing card");
        }
        expect(row.quantity).toBe(1);
        expect(statusOf(row)).toBe(card.status);
        if (format.carries.tags) {
          expect(row.tags).toEqual(card.tags);
        }
        if (format.carries.notes) {
          expect(row.notes).toBe(card.notes);
        }
        if (
          format.carries.printing === "id" &&
          card.printingId !== undefined &&
          format.id === "cockatrice"
        ) {
          expect(row.printingId).toBe(card.printingId);
        }
        if (
          format.carries.printing === "id" &&
          format.id === "mtgo-dek" &&
          card.mtgoId !== undefined
        ) {
          expect(row.mtgoId).toBe(card.mtgoId);
        }
        if (format.carries.printing === "set-number" && card.set !== undefined) {
          expect(row.set).toBe(card.set);
          expect(row.collectorNumber).toBe(card.collectorNumber);
        }
      });
    });
  }

  it("says what each format loses", () => {
    const losses = Object.fromEntries(
      EXPORT_FORMATS.map((format) => [format.id, formatLosses(format)]),
    );
    expect(losses["cubecobra-csv"]).toEqual([]);
    expect(losses["draftmancer"]).toEqual(["prospects", "cuts", "tags", "notes"]);
    expect(losses["mtgo-txt"]).toEqual(["cuts", "tags", "notes", "printings"]);
  });
});

describe("names per target", () => {
  const card = (name: string, layout: string) => ({ name, layout });
  it("keeps split cards whole and cuts DFCs to the front face", () => {
    expect(exportName(card("Fire // Ice", "split"), "front-except-split")).toBe("Fire // Ice");
    expect(
      exportName(card("Grave Researcher // Reanimate", "transform"), "front-except-split"),
    ).toBe("Grave Researcher");
    expect(exportName(card("Bonecrusher Giant // Stomp", "adventure"), "cockatrice")).toBe(
      "Bonecrusher Giant // Stomp",
    );
    expect(exportName(card("Fire // Ice", "split"), "mtgo")).toBe("Fire/Ice");
  });

  it("offers slash and front-face candidates", () => {
    expect(nameCandidates("Refuse/Cooperate")).toEqual([
      "Refuse/Cooperate",
      "Refuse // Cooperate",
      "Refuse",
    ]);
    expect(nameCandidates("Abrade")).toEqual(["Abrade"]);
  });
});

describe("Cube Cobra CSV", () => {
  it("parses the documented example row", () => {
    const text = [
      '"name","CMC","Type","Color","Set","Collector Number","Rarity","Color Category","status","Finish","board","maybeboard","image URL","image Back URL","tags","Notes","MTGO ID","Custom","Voucher","Artist","Voucher Cards"',
      '"Abrade","2","Instant","R","soa","37","uncommon","Red","Not Owned","Non-foil","mainboard","false","","","removal;burn","","-1","false","false","",""',
    ].join("\r\n");
    expect(detectFormat(text)).toBe("cubecobra-csv");
    const [row] = parseList(text).rows;
    expect(row).toMatchObject({
      name: "Abrade",
      board: "main",
      set: "soa",
      collectorNumber: "37",
      tags: ["removal", "burn"],
    });
    expect(row?.mtgoId).toBeUndefined();
  });

  it("uses maybeboard when board is empty and strips the formula guard", () => {
    const text = 'name,board,maybeboard,Notes\nAbrade,,true,"\'=x"\n';
    expect(parseList(text).rows[0]).toMatchObject({ board: "maybe", notes: "=x" });
  });

  it("leaves Scryfall-derived columns empty so they don't become overrides", () => {
    const [, line] = (exportFormat("cubecobra-csv")?.write(CARDS, META) ?? "").split("\r\n");
    expect(parseCsv(line ?? "")[0]?.slice(1, 4)).toEqual(["", "", ""]);
  });

  it("quotes cells and guards formulas", () => {
    expect(csvCell('a "b"')).toBe('"a ""b"""');
    expect(csvCell("=1+1")).toBe('"\'=1+1"');
    expect(csvCell("-1")).toBe('"-1"');
  });
});

describe("Cube Cobra JSON", () => {
  it("reads every board, printing ids, tags, and notes", () => {
    const json = JSON.stringify({
      name: "Some Cube",
      cards: {
        mainboard: [
          {
            cardID: "c5bb5307-e874-42c4-b85d-06b9f6c474c8",
            tags: ["burn"],
            notes: "n",
            details: { name: "Abrade", set: "SOA", collector_number: "37" },
          },
        ],
        maybeboard: [{ cardID: "x", tags: [], details: { name: "Fire // Ice" } }],
        cut: [{ custom_name: "Homebrew" }],
      },
    });
    const parsed = parseList(json);
    expect(parsed.format).toBe("cubecobra-json");
    expect(parsed.title).toBe("Some Cube");
    expect(parsed.rows.map((row) => [row.name, row.board])).toEqual([
      ["Abrade", "main"],
      ["Fire // Ice", "maybe"],
      ["Homebrew", "cut"],
    ]);
    expect(parsed.rows[0]).toMatchObject({
      printingId: "c5bb5307-e874-42c4-b85d-06b9f6c474c8",
      set: "soa",
      tags: ["burn"],
      notes: "n",
    });
  });
});

describe("Cube Cobra and Draftmancer text", () => {
  it("reads Cube Cobra plaintext board headers", () => {
    const parsed = parseList(
      "# mainboard\nAbrade\nGrave Researcher\n\n# maybeboard\nFire // Ice\n",
    );
    expect(parsed.format).toBe("text");
    expect(parsed.rows.map((row) => [row.name, row.board])).toEqual([
      ["Abrade", "main"],
      ["Grave Researcher", "main"],
      ["Fire // Ice", "maybe"],
    ]);
  });

  it("reads the documented Draftmancer list", () => {
    const parsed = parseList(
      '[Settings]\n{ "name": "Max\'s Cube" }\n[Main]\n1 Abrade (SOA) 37\nGrave Researcher // Reanimate\n',
    );
    expect(parsed.format).toBe("draftmancer");
    expect(parsed.title).toBe("Max's Cube");
    expect(parsed.rows.map((row) => [row.name, row.set, row.collectorNumber])).toEqual([
      ["Abrade", "soa", "37"],
      ["Grave Researcher // Reanimate", undefined, undefined],
    ]);
  });

  it("sizes Draftmancer boosters for a two-player Winston draft", () => {
    expect(
      EXPORT_FORMATS.find((format) => format.id === "draftmancer")?.write(CARDS, META),
    ).toContain('"boostersPerPlayer": 3');
  });
});

describe("tolerant line parser", () => {
  it.each([
    ["4x Plains", { name: "Plains", quantity: 4 }],
    [
      "1 Teferi, Hero of Dominaria (DAR) 207",
      { name: "Teferi, Hero of Dominaria", set: "dar", collectorNumber: "207" },
    ],
    ["1 Benalish Marshal (PDOM) 6p", { name: "Benalish Marshal", collectorNumber: "6p" }],
    [
      "SB: 3 [ZNR:315] Archon of Emeria",
      {
        name: "Archon of Emeria",
        quantity: 3,
        sideboard: true,
        set: "znr",
        collectorNumber: "315",
      },
    ],
    ["1 [WAR:2*] Ugin, the Ineffable", { name: "Ugin, the Ineffable", collectorNumber: "2*" }],
    ["4 Plains [M20] 261", { name: "Plains", set: "m20", collectorNumber: "261" }],
    [
      "2 Witch Enchanter // Witch-Blessed Meadow (MH3) 239",
      { name: "Witch Enchanter // Witch-Blessed Meadow", quantity: 2 },
    ],
    [
      "1x Austere Command (cmr) [Maybeboard{noDeck}{noPrice}]  ^Getting,#2ccce4^",
      { name: "Austere Command", set: "cmr", categoryBoard: "maybe", tags: [] },
    ],
    [
      "1x Sol Ring (c21) 263 *F* [Ramp,Rock/Dork]",
      { name: "Sol Ring", collectorNumber: "263", tags: ["Ramp", "Rock/Dork"] },
    ],
    ["1 Lightning Bolt #removal #!burn", { name: "Lightning Bolt", tags: ["removal", "burn"] }],
    ["1 Delver of Secrets (Transform)", { name: "Delver of Secrets" }],
  ])("%s", (line, expected) => {
    expect(parseCardLine(line)).toMatchObject(expected);
  });
});

describe("real files", () => {
  it("imports XMage's MTGO .dek sample", () => {
    const parsed = parseList(fixture("testdeck.dek"));
    expect(parsed.format).toBe("mtgo-dek");
    expect(parsed.rows.map((row) => [row.name, row.quantity, row.board, row.mtgoId])).toEqual([
      ["Nezumi Shortfang", 2, "main", 21_213],
      ["Kessig Prowler", 1, "main", 61_446],
      ["Murderous Rider", 1, "main", 78_308],
      ["Refuse/Cooperate", 1, "main", 64_832],
      ["Riverglide Pathway", 2, "side", 83_533],
      ["Dead/Gone", 1, "side", 26_517],
    ]);
  });

  it("imports XMage's Arena sample with a blank-line sideboard", () => {
    const parsed = parseList(fixture("testdeck.mtga"));
    expect(parsed.format).toBe("text");
    expect(parsed.rows).toHaveLength(12);
    expect(parsed.rows[4]).toMatchObject({
      name: "Expansion // Explosion",
      set: "grn",
      collectorNumber: "224",
    });
    expect(parsed.rows[9]).toMatchObject({ name: "Benalish Marshal", board: "main" });
    expect(parsed.rows.slice(10).map((row) => [row.name, row.quantity, row.board])).toEqual([
      ["Unmoored Ego", 3, "side"],
      ["Beacon Bolt", 1, "side"],
    ]);
  });

  it("imports XMage's .dck sample and skips layout lines", () => {
    const parsed = parseList(fixture("testdeck.dck"));
    expect(parsed.rows.map((row) => [row.name, row.set, row.collectorNumber, row.board])).toEqual([
      ["Ugin, the Ineffable", "war", "2*", "main"],
      ["Cephalid Looter", "ody", "72+", "main"],
      ["Adventure Awaits", "znr", "177", "main"],
      ["Acquisitions Expert", "znr", "89", "main"],
      ["Archon of Emeria", "znr", "315", "side"],
      ["Akoum Hellhound", "znr", "133", "side"],
    ]);
  });

  it("imports a Cockatrice .cod with zones and a deck name", () => {
    const parsed = parseList(fixture("testdeck.cod"));
    expect(parsed.format).toBe("cockatrice");
    expect(parsed.title).toBe("Deck Name");
    expect(parsed.rows.map((row) => [row.name, row.quantity, row.board])).toEqual([
      ["Forest", 12, "main"],
      ["Razorverge Thicket", 5, "main"],
      ["Avacyn's Pilgrim", 1, "main"],
      ["@#$NOT A REAL CARD NAME@#$", 1, "main"],
      ["War Priest of Thune", 3, "side"],
    ]);
  });
});
