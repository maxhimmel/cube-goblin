import type { Card } from "@repo/scryfall";
import { cardFaces, imageUrl } from "@repo/scryfall";
import { chalk } from "zx";

export function formatCard(card: Card): string {
  const lines: string[] = [];
  for (const face of cardFaces(card)) {
    const cost = face.mana_cost ? ` ${chalk.yellow(face.mana_cost)}` : "";
    lines.push(`${chalk.bold(face.name)}${cost}`);
    if (face.type_line) {
      lines.push(chalk.dim(face.type_line));
    }
    if (face.oracle_text) {
      lines.push(face.oracle_text);
    }
    const stats =
      face.power !== undefined ? `${face.power}/${face.toughness ?? "?"}` : face.loyalty;
    if (stats !== undefined) {
      lines.push(chalk.cyan(stats));
    }
  }
  lines.push(chalk.blue(card.scryfall_uri.split("?")[0] ?? card.scryfall_uri));
  const image = imageUrl(card);
  if (image) {
    lines.push(chalk.dim(image));
  }
  return lines.join("\n");
}

export function formatCardLine(card: Card): string {
  const cost = card.mana_cost ? chalk.yellow(card.mana_cost) : "";
  return [chalk.bold(card.name), cost, chalk.dim(card.type_line ?? "")].filter(Boolean).join("  ");
}
