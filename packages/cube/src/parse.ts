export interface BatchLine {
  line: number;
  input: string;
  name: string;
}

const BULLET = /^\s*\[\s*[xX]?\s*\]\s*/u;

export function parseBatch(source: string): BatchLine[] {
  const entries: BatchLine[] = [];
  source.split(/\r?\n/u).forEach((raw, index) => {
    const text = raw.replace(BULLET, "").trim();
    if (text.length > 0) {
      entries.push({ line: index + 1, input: raw, name: text });
    }
  });
  return entries;
}
