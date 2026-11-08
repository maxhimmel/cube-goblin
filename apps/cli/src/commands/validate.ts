import { readCards, readConfig, readSections, readTags, validateCube } from "@repo/cube";
import { chalk } from "zx";
import { CUBE_PATHS } from "../paths.ts";

export async function validate(): Promise<number> {
  const [cards, sections, tags, config] = await Promise.all([
    readCards(CUBE_PATHS),
    readSections(CUBE_PATHS),
    readTags(CUBE_PATHS),
    readConfig(CUBE_PATHS),
  ]);
  const problems = validateCube(cards, sections, tags);
  for (const problem of problems) {
    console.error(chalk.red(problem));
  }
  const drafts = cards.filter((card) => card.status === "draft").length;
  const { min, max } = config.size;
  const sizeNote =
    drafts < min || drafts > max
      ? chalk.yellow(`draft is ${String(drafts)}, target ${String(min)}-${String(max)}`)
      : chalk.green(`draft is ${String(drafts)}, within ${String(min)}-${String(max)}`);
  console.log(`${String(cards.length)} cards valid. ${sizeNote}`);
  return problems.length > 0 ? 1 : 0;
}
