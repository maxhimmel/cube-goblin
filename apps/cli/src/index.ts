#!/usr/bin/env tsx
import { parseArgs } from "node:util";
import { ScryfallError } from "@repo/scryfall";
import { chalk } from "zx";
import { createClient } from "./client.ts";
import { addBatch } from "./commands/add.ts";
import { importReview } from "./commands/review.ts";
import { snapshot } from "./commands/snapshot.ts";
import { validate } from "./commands/validate.ts";
import { formatCard, formatCardLine } from "./format.ts";

const USAGE = `Usage: cube <command> [options]

Commands:
  card <name>          Look up one card (exact name; --fuzzy for partial)
  cards <name...>      Look up many cards at once
  search <query>       Scryfall search syntax, e.g. "o:graveyard t:sorcery"
  add <batch-file>     Parse a batch list, resolve on Scryfall, write cube/cards/*.json
  validate             Check cube files: schema, singleton, sections, size
  snapshot             Bake cube + Scryfall data + images for the share doc build
  review import <src>  Import a friend's review (saved .html, code, or .json)

Options:
  --fuzzy              Fuzzy name match (card)
  --limit <n>          Max results (search, default 20)
  --json               Print raw JSON
  --dry-run            Resolve without writing (add)
  -h, --help           Show this help`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    fuzzy: { type: "boolean", default: false },
    limit: { type: "string", default: "20" },
    json: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

const [command, ...rest] = positionals;

function print(data: unknown, pretty: () => string): void {
  console.log(values.json ? JSON.stringify(data, null, 2) : pretty());
}

async function run(): Promise<number> {
  if (values.help || command === undefined) {
    console.log(USAGE);
    return values.help ? 0 : 1;
  }
  switch (command) {
    case "add": {
      const [file] = rest;
      if (file === undefined) {
        console.error("add: batch file required");
        return 1;
      }
      return addBatch(file, { dryRun: values["dry-run"] });
    }
    case "validate": {
      return validate();
    }
    case "snapshot": {
      return snapshot();
    }
    case "review": {
      const [action, source] = rest;
      if (action !== "import" || source === undefined) {
        console.error("review: usage: review import <file|code>");
        return 1;
      }
      return importReview(source);
    }
    case "card": {
      const name = rest.join(" ");
      if (!name) {
        console.error("card: name required");
        return 1;
      }
      const card = await createClient().named(name, { fuzzy: values.fuzzy });
      print(card, () => formatCard(card));
      return 0;
    }
    case "cards": {
      if (rest.length === 0) {
        console.error("cards: at least one name required");
        return 1;
      }
      const { cards, notFound } = await createClient().collection(rest.map((name) => ({ name })));
      print({ cards, notFound }, () =>
        [
          ...cards.map((card) => formatCard(card)),
          ...notFound.map((entry) => chalk.red(`not found: ${JSON.stringify(entry)}`)),
        ].join("\n\n"),
      );
      return notFound.length > 0 ? 1 : 0;
    }
    case "search": {
      const query = rest.join(" ");
      const limit = Number.parseInt(values.limit, 10);
      if (!query || Number.isNaN(limit) || limit < 1) {
        console.error("search: query and a positive --limit required");
        return 1;
      }
      const cards = await createClient().search(query, { limit });
      print(cards, () => cards.map((card) => formatCardLine(card)).join("\n"));
      return 0;
    }
    default: {
      console.error(`Unknown command: ${command}\n\n${USAGE}`);
      return 1;
    }
  }
}

try {
  process.exitCode = await run();
} catch (error) {
  if (error instanceof ScryfallError) {
    console.error(chalk.red(`Scryfall ${String(error.status)} ${error.code}: ${error.message}`));
    process.exitCode = 1;
  } else {
    throw error;
  }
}
