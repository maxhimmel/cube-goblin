import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export const TICKET_STATUSES = ["todo", "doing", "blocked", "done"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const ROADMAP_SECTIONS = ["Now", "Next", "Later", "Done"] as const;
export type RoadmapSection = (typeof ROADMAP_SECTIONS)[number];

export const HANDOFF_FIELDS = ["Updated", "State", "Next step"] as const;

export const HANDOFF_MAX_WORDS = 200;

export const DATA_PATHS = ["cube/"] as const;

export function isDataOnly(files: readonly string[]): boolean {
  const changed = files.filter((file) => file !== "");
  return (
    changed.length > 0 && changed.every((file) => DATA_PATHS.some((path) => file.startsWith(path)))
  );
}

export interface Ticket {
  file: string;
  id: string;
  title: string;
  status: string;
}

const FILE_PATTERN = /^(T-\d{3})-[a-z0-9-]+\.md$/u;
const LINK_PATTERN = /\]\(tickets\/([^)]+)\)/gu;

export function parseFrontmatter(source: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---\n/u.exec(source);
  const fields: Record<string, string> = {};
  for (const line of match?.[1]?.split("\n") ?? []) {
    const separator = line.indexOf(":");
    if (separator > 0) {
      fields[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    }
  }
  return fields;
}

export function parseTicket(file: string, source: string): Ticket {
  const fields = parseFrontmatter(source);
  return {
    file,
    id: fields["id"] ?? "",
    title: fields["title"] ?? "",
    status: fields["status"] ?? "",
  };
}

export function roadmapSections(roadmap: string): Map<string, string> {
  const sections = new Map<string, string>();
  let current: string | undefined;
  for (const line of roadmap.split("\n")) {
    const heading = /^## (.+)$/u.exec(line);
    if (heading?.[1]) {
      current = heading[1].trim();
      sections.set(current, "");
    } else if (current !== undefined) {
      sections.set(current, `${sections.get(current) ?? ""}${line}\n`);
    }
  }
  return sections;
}

function isStatus(value: string): value is TicketStatus {
  return (TICKET_STATUSES as readonly string[]).includes(value);
}

export function validateRoadmap(roadmap: string, tickets: readonly Ticket[]): string[] {
  const problems: string[] = [];
  const sections = roadmapSections(roadmap);

  const handoff = sections.get("Handoff");
  if (handoff === undefined) {
    problems.push("ROADMAP.md: missing '## Handoff' section");
  } else {
    for (const field of HANDOFF_FIELDS) {
      if (!new RegExp(`^- \\*\\*${field}\\*\\*: \\S`, "mu").test(handoff)) {
        problems.push(`ROADMAP.md: Handoff is missing a filled '- **${field}**:' line`);
      }
    }
    const words = handoff.split(/\s+/u).filter((word) => word !== "").length;
    if (words > HANDOFF_MAX_WORDS) {
      problems.push(
        `ROADMAP.md: Handoff is ${String(words)} words (max ${String(HANDOFF_MAX_WORDS)}); point to tickets and docs instead of restating them`,
      );
    }
  }

  const placement = new Map<string, RoadmapSection[]>();
  for (const section of ROADMAP_SECTIONS) {
    const body = sections.get(section);
    if (body === undefined) {
      problems.push(`ROADMAP.md: missing '## ${section}' section`);
      continue;
    }
    for (const match of body.matchAll(LINK_PATTERN)) {
      const file = match[1] ?? "";
      placement.set(file, [...(placement.get(file) ?? []), section]);
    }
  }

  const byFile = new Map(tickets.map((ticket) => [ticket.file, ticket]));
  for (const file of placement.keys()) {
    if (!byFile.has(file)) {
      problems.push(`ROADMAP.md links to missing ticket ${file}`);
    }
  }

  for (const ticket of tickets) {
    const fileId = FILE_PATTERN.exec(ticket.file)?.[1];
    if (fileId === undefined) {
      problems.push(`${ticket.file}: name must be T-NNN-slug.md`);
    } else if (ticket.id !== fileId) {
      problems.push(`${ticket.file}: frontmatter id '${ticket.id}' should be '${fileId}'`);
    }
    if (ticket.title.length === 0) {
      problems.push(`${ticket.file}: frontmatter title is empty`);
    }
    if (!isStatus(ticket.status)) {
      problems.push(
        `${ticket.file}: status '${ticket.status}' must be one of ${TICKET_STATUSES.join(", ")}`,
      );
      continue;
    }
    const places = placement.get(ticket.file) ?? [];
    if (places.length !== 1) {
      problems.push(
        `${ticket.file}: listed ${String(places.length)} times in ROADMAP.md (must be exactly once)`,
      );
      continue;
    }
    const [section] = places;
    if ((ticket.status === "done") !== (section === "Done")) {
      problems.push(
        `${ticket.file}: status '${ticket.status}' doesn't match roadmap section '${section ?? ""}'`,
      );
    }
    if (ticket.status === "doing" && section !== "Now") {
      problems.push(`${ticket.file}: 'doing' tickets belong under Now`);
    }
  }
  return problems;
}

export async function loadRoadmap(
  docsDir: string,
): Promise<{ roadmap: string; tickets: Ticket[] }> {
  const ticketsDir = join(docsDir, "tickets");
  const files = (await readdir(ticketsDir)).filter((file) => file.endsWith(".md")).sort();
  const tickets = await Promise.all(
    files.map(async (file) => parseTicket(file, await readFile(join(ticketsDir, file), "utf8"))),
  );
  return { roadmap: await readFile(join(docsDir, "ROADMAP.md"), "utf8"), tickets };
}
