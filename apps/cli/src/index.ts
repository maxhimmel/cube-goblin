#!/usr/bin/env tsx
import { parseArgs } from "node:util";
import type { CubePaths } from "@repo/cube";
import { NotACubeFolder, openCubeFolder } from "@repo/cube";
import { ScryfallError } from "@repo/scryfall";
import { chalk } from "zx";
import { createClient } from "./client.ts";
import { addBatch } from "./commands/add.ts";
import { backfillLog } from "./commands/backfill-log.ts";
import { exportCube } from "./commands/export.ts";
import { importList, parseBoardOptions } from "./commands/import.ts";
import { pinPrintings } from "./commands/pin-printings.ts";
import { importReview } from "./commands/review.ts";
import { shareVersion } from "./commands/share-version.ts";
import { snapshot } from "./commands/snapshot.ts";
import { tagFunctions } from "./commands/tag-functions.ts";
import { validate } from "./commands/validate.ts";
import { formatCard, formatCardLine } from "./format.ts";
import { REPO_CUBE } from "./paths.ts";

const USAGE = `Usage: cube <command> [options]

Commands:
  card <name>          Look up one card (exact name; --fuzzy for partial)
  cards <name...>      Look up many cards at once
  search <query>       Scryfall search syntax, e.g. "o:graveyard t:sorcery"
  add <batch-file>     Parse a batch list, resolve on Scryfall, write <cube>/cards/*.json
  validate             Check cube files: schema, singleton, tags, board, size
  pin-printings        Save each card's current printing so Scryfall can't change it
  tag-functions        Add Scryfall function tags (removal, ramp, …) to every card, once
  backfill-log         Rebuild change log entries from git history, before the live ones
  snapshot             Bake cube + Scryfall data + images for the share doc build
  share-version        Save a version of the cube the current snapshot ships, once per snapshot
  review import <src>  Import a friend's review (saved .html, code, or .json)
  import <file|url>    Import another site's list (Cube Cobra, Draftmancer, MTGO, Arena,
                       Moxfield, Archidekt, Cockatrice, XMage) or a Cube Cobra cube URL
  export               Write the cube in another site's format (--format, --out)

Options:
  --cube <dir>         Cube folder to work on (default: this repo's cube/)
  --fuzzy              Fuzzy name match (card)
  --limit <n>          Max results (search, default 20)
  --json               Print raw JSON
  --dry-run            Resolve without writing (add, import, pin-printings, tag-functions, backfill-log)
  --new <dir>          import: make a new cube folder inside <dir> instead of merging
  --board <b>=<status> import: map a board to draft, prospect, cut, or skip (repeatable)
  --format <id>        export: cubecobra-csv, draftmancer, arena, mtgo-txt, mtgo-dek,
                       moxfield, archidekt, cockatrice, xmage
  --out <file>         export: write to a file instead of stdout
  -h, --help           Show this help`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    cube: { type: "string", default: REPO_CUBE },
    fuzzy: { type: "boolean", default: false },
    limit: { type: "string", default: "20" },
    json: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    new: { type: "string" },
    board: { type: "string", multiple: true, default: [] },
    format: { type: "string" },
    out: { type: "string" },
    help: { type: "boolean", short: "h", default: false },
  },
});

const [command, ...rest] = positionals;

function print(data: unknown, pretty: () => string): void {
  console.log(values.json ? JSON.stringify(data, null, 2) : pretty());
}

async function cube(): Promise<CubePaths> {
  return (await openCubeFolder(values.cube)).paths;
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
      return addBatch(await cube(), file, { dryRun: values["dry-run"] });
    }
    case "import": {
      const [source] = rest;
      if (source === undefined) {
        console.error("import: file or Cube Cobra URL required");
        return 1;
      }
      const boards = parseBoardOptions(values.board);
      if (typeof boards === "string") {
        console.error(boards);
        return 1;
      }
      return importList(await cube(), source, {
        dryRun: values["dry-run"],
        boards,
        ...(values.new === undefined ? {} : { newCube: values.new }),
      });
    }
    case "export": {
      return exportCube(await cube(), values.format, values.out);
    }
    case "validate": {
      return validate(await cube());
    }
    case "pin-printings": {
      return pinPrintings(await cube(), values["dry-run"]);
    }
    case "tag-functions": {
      return tagFunctions(await cube(), values["dry-run"]);
    }
    case "backfill-log": {
      return backfillLog(await cube(), values["dry-run"]);
    }
    case "snapshot": {
      return snapshot(await cube());
    }
    case "share-version": {
      return shareVersion(await cube());
    }
    case "review": {
      const [action, source] = rest;
      if (action !== "import" || source === undefined) {
        console.error("review: usage: review import <file|code>");
        return 1;
      }
      return importReview(await cube(), source);
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
  } else if (error instanceof NotACubeFolder) {
    console.error(chalk.red(error.message));
    process.exitCode = 1;
  } else {
    throw error;
  }
}
