import { describe, expect, it } from "vitest";
import type { QueryCard } from "./query.ts";
import {
  bucketQuery,
  compileQuery,
  joinQuery,
  namesStatus,
  queryParts,
  removePart,
  tagsIn,
} from "./query.ts";
import type { Bucket, BucketKind } from "./stats.ts";
import {
  COLOR_GROUPS,
  COLORS,
  CURVE_COLUMNS,
  PRESENCE_GROUPS,
  PT_VALUES,
  TYPE_COLUMNS,
  inBucket,
} from "./stats.ts";

function card(overrides: Partial<QueryCard>): QueryCard {
  return {
    status: "draft",
    name: "Card",
    colors: [],
    cmc: 0,
    typeLine: "Instant",
    manaCost: "",
    oracleText: "",
    tags: [],
    ...overrides,
  };
}

const CARDS: QueryCard[] = [
  card({ name: "Bolt", colors: ["R"], cmc: 1, manaCost: "{R}", tags: ["removal", "burn"] }),
  card({ name: "Fireball", colors: ["R"], cmc: 2, manaCost: "{X}{R}{R}", typeLine: "Sorcery" }),
  card({
    name: "Bear",
    colors: ["G"],
    cmc: 2,
    manaCost: "{1}{G}",
    typeLine: "Creature — Bear",
    power: "2",
    toughness: "2",
  }),
  card({
    name: "Goyf",
    colors: ["G"],
    cmc: 2,
    manaCost: "{1}{G}",
    typeLine: "Creature — Lhurgoyf",
    power: "*",
    toughness: "1+*",
    status: "prospect",
  }),
  card({
    name: "Titan",
    colors: ["G"],
    cmc: 8,
    manaCost: "{6}{G}{G}",
    typeLine: "Creature — Giant",
    power: "9",
    toughness: "9",
  }),
  card({
    name: "Helix",
    colors: ["R", "W"],
    cmc: 2,
    manaCost: "{R}{W}",
    tags: ["removal"],
    status: "cut",
  }),
  card({
    name: "Hybrid",
    colors: ["U", "R"],
    cmc: 3,
    manaCost: "{U/R}{U/R}{U/R}",
    typeLine: "Artifact Creature — Golem",
    power: "3",
    toughness: "3",
  }),
  card({ name: "Mox", cmc: 0, manaCost: "{0}", typeLine: "Artifact" }),
  card({ name: "Island", typeLine: "Land — Island" }),
  card({
    name: "Bridge",
    colors: ["W"],
    cmc: 3,
    manaCost: "{2}{W} // ",
    typeLine: "Instant // Land",
  }),
  card({
    name: "Wall",
    colors: ["W"],
    cmc: 1,
    manaCost: "{W}",
    typeLine: "Creature — Wall",
    power: "0",
    toughness: "4",
  }),
  card({ name: "Planes", colors: ["U", "B"], cmc: 4, typeLine: "Legendary Planeswalker — Ral" }),
  card({ name: "Odd", cmc: 5, typeLine: "Kindred Tribal — Elf" }),
];

function buckets(): Bucket[] {
  const make = (kind: BucketKind, ...keys: string[]): Bucket => ({ kind, keys });
  const curve = CURVE_COLUMNS.map((column) => column.id);
  const pt = PT_VALUES.map((value) => value.id);
  return [
    ...curve.map((key) => make("curve", key)),
    ...COLOR_GROUPS.map((group) => make("color", group.id)),
    ...COLOR_GROUPS.flatMap((group) => curve.map((key) => make("colorCurve", group.id, key))),
    ...PRESENCE_GROUPS.map((group) => make("presence", group.id)),
    ...COLORS.map((color) => make("colorMulti", color.id)),
    ...COLORS.map((color) => make("heavy", color.id)),
    ...TYPE_COLUMNS.map((type) => make("type", type.id)),
    ...pt.flatMap((power) => pt.map((toughness) => make("pt", power, toughness))),
    make("body", "2", "2"),
    make("body", "0", "4"),
    make("body", "9", "9"),
    ...curve.map((key) => make("creatureCurve", key)),
    make("status", "draft"),
    make("status", "prospect"),
    make("status", "cut"),
    make("tag", "removal"),
    make("tag", "burn"),
  ];
}

describe("bucketQuery", () => {
  it("matches exactly the cards in every chart bucket", () => {
    for (const bucket of buckets()) {
      const query = bucketQuery(bucket);
      const result = compileQuery(query);
      expect(result.ok, query).toBe(true);
      if (!result.ok) {
        continue;
      }
      const viaQuery = CARDS.filter(result.test).map((entry) => entry.name);
      const viaBucket = CARDS.filter((entry) => inBucket(entry, bucket)).map((entry) => entry.name);
      expect(viaQuery, `${bucket.kind}:${bucket.keys.join(":")} → ${query}`).toEqual(viaBucket);
    }
  });
});

function names(query: string): (string | undefined)[] {
  const result = compileQuery(query);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return CARDS.filter(result.test).map((entry) => entry.name);
}

describe("compileQuery", () => {
  it("compares numbers, fields, and variable stats", () => {
    expect(names("pow>=9")).toEqual(["Titan"]);
    expect(names("tou>pow")).toEqual(["Wall"]);
    expect(names("pow=*")).toEqual(["Goyf"]);
    expect(names("mv>=8")).toEqual(["Titan"]);
    expect(names("mv=0")).toEqual(["Mox"]);
  });

  it("matches colors, types, text, tags, and status", () => {
    expect(names("c:ur")).toEqual(["Hybrid"]);
    expect(names("c=r")).toEqual(["Bolt", "Fireball"]);
    expect(names("c:m -t:planeswalker")).toEqual(["Helix", "Hybrid"]);
    expect(names("t:golem")).toEqual(["Hybrid"]);
    expect(names("tag:removal is:draft")).toEqual(["Bolt"]);
    expect(names("bridg")).toEqual(["Bridge"]);
    expect(names('name:"tit"')).toEqual(["Titan"]);
  });

  it("negates, ors, and groups", () => {
    expect(names("(c=r or c=w) -t:creature")).toEqual(["Bolt", "Fireball", "Bridge"]);
    expect(names("t:creature -(pow>=3 or tou>=4)")).toEqual(["Bear", "Goyf"]);
  });

  it("reports errors with a position", () => {
    expect(compileQuery("foo:bar")).toMatchObject({ ok: false, error: 'Unknown keyword "foo"' });
    expect(compileQuery("(pow>1")).toMatchObject({ ok: false, error: "Missing )" });
    expect(compileQuery("pow>x")).toMatchObject({ ok: false });
    expect(compileQuery("c:q")).toMatchObject({ ok: false });
    expect(compileQuery("is:maybe")).toMatchObject({ ok: false });
    expect(compileQuery('o:"open')).toMatchObject({ ok: false, error: "Missing closing quote" });
  });

  it("reads and as an explicit join that binds tighter than or", () => {
    expect(names("c=r and t:creature")).toEqual(names("c=r t:creature"));
    expect(names("t:creature AND c=g or c=w")).toEqual(names("(t:creature c=g) or c=w"));
    expect(compileQuery("and c=r")).toMatchObject({
      ok: false,
      error: '"and" needs something before it',
    });
    expect(compileQuery("c=r and")).toMatchObject({
      ok: false,
      error: '"and" needs something after it',
    });
    expect(compileQuery("c=r and or c=g")).toMatchObject({ ok: false });
    expect(compileQuery('a "and" b')).toMatchObject({ ok: true });
  });

  it("matches everything when empty", () => {
    expect(names("")).toHaveLength(CARDS.length);
  });
});

describe("query helpers", () => {
  it("splits the top level into parts and removes one", () => {
    const query = "t:creature -c:g (tag:a or tag:b)";
    const parts = queryParts(query);
    expect(parts.map((part) => [part.text, part.kind])).toEqual([
      ["t:creature", "term"],
      ["-c:g", "term"],
      ["(tag:a or tag:b)", "group"],
    ]);
    const second = parts[1];
    expect(second && removePart(query, second)).toBe("t:creature (tag:a or tag:b)");
    expect(queryParts("a or b").map((part) => part.text)).toEqual(["a or b"]);
  });

  it("splits around an explicit and and drops it with a removed part", () => {
    const query = "c=r and t:creature and mv<=2";
    const parts = queryParts(query);
    expect(parts.map((part) => part.text)).toEqual(["c=r", "t:creature", "mv<=2"]);
    const [first, second, third] = parts;
    expect(first && removePart(query, first)).toBe("t:creature and mv<=2");
    expect(second && removePart(query, second)).toBe("c=r and mv<=2");
    expect(third && removePart(query, third)).toBe("c=r and t:creature");
  });

  it("joins parts, wrapping bare ors", () => {
    expect(joinQuery("t:creature", "c:r or c:g", "")).toBe("t:creature (c:r or c:g)");
  });

  it("finds status and tags", () => {
    expect(namesStatus("tag:x is:draft")).toBe(true);
    expect(namesStatus("-is:draft is:spell")).toBe(false);
    expect(tagsIn("tag:a -(tag:b or c:r)")).toEqual(["a", "b"]);
  });
});

describe("review fixes", () => {
  it("wraps any top-level or when joining", () => {
    expect(joinQuery("mv=2", "(t:creature or t:artifact) or c:w")).toBe(
      "mv=2 ((t:creature or t:artifact) or c:w)",
    );
    expect(joinQuery("mv=2", "(c:w or c:u)")).toBe("mv=2 (c:w or c:u)");
  });

  it("removes parts without disturbing the rest", () => {
    const query = 'o:"a  b"  tag:x  tag:y';
    const parts = queryParts(query);
    const rest = parts
      .toReversed()
      .filter((part) => part.text.startsWith("tag:"))
      .reduce((current, part) => removePart(current, part), query);
    expect(rest).toBe('o:"a  b"');
  });

  it("keeps a wrapped group as one part and negated terms as terms", () => {
    expect(queryParts("(a b) c").map((part) => [part.text, part.kind])).toEqual([
      ["(a b)", "group"],
      ["c", "term"],
    ]);
    expect(queryParts("(mv=2)").map((part) => part.kind)).toEqual(["group"]);
    expect(queryParts("-tag:x").map((part) => part.kind)).toEqual(["term"]);
  });

  it("rejects a lone minus and * with an ordering operator", () => {
    expect(compileQuery("a -")).toMatchObject({ ok: false });
    expect(compileQuery("-")).toMatchObject({ ok: false });
    expect(compileQuery("pow<*")).toMatchObject({ ok: false });
  });

  it("treats a quoted or as a word", () => {
    expect(names('"or"')).toEqual([]);
    expect(compileQuery('a "or" b')).toMatchObject({ ok: true });
  });

  it("only counts a status that every match must have", () => {
    expect(namesStatus("is:draft or t:creature")).toBe(false);
    expect(namesStatus("(is:draft t:creature) mv=2")).toBe(true);
  });
});
