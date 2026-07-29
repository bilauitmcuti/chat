/** Split a markdown pipe row into cells (keeps empty cells between pipes). */
export function splitPipeCells(line: string): string[] {
  const t = line.trim();
  if (!t.includes("|")) return [];
  const parts = t.split("|").map((c) => c.trim());
  if (parts.length > 0 && parts[0] === "") parts.shift();
  if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

export function isMarkdownTableSeparator(line: string): boolean {
  const cells = splitPipeCells(line);
  return cells.length >= 2 && cells.every((c) => /^:?-{3,}:?$/.test(c));
}

export function isPipeTableRow(line: string): boolean {
  return splitPipeCells(line).length >= 2;
}

/** Single filled cell in a pipe row — usually a title, not column headers. */
export function isTableCaptionRow(line: string): boolean {
  const cells = splitPipeCells(line);
  return cells.filter((c) => c.length > 0).length === 1;
}

function defaultHeaders(colCount: number): string[] {
  const defaults = ["Activity", "Date", "Notes", "Details"];
  return Array.from({ length: colCount }, (_, i) => defaults[i] ?? `Column ${i + 1}`);
}

function padRow(cells: string[], colCount: number): string[] {
  const row = [...cells];
  while (row.length < colCount) row.push("");
  return row.slice(0, colCount);
}

/**
 * Wrap GitHub-style markdown pipe tables in [TABLE]...[/TABLE] so the chat UI renders them.
 * Leaves existing [TABLE] blocks unchanged.
 */
export function normalizeAssistantTables(text: string): string {
  if (/\[TABLE\]/i.test(text)) return text;

  const rawLines = text.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i] ?? "";
    const line2 = rawLines[i + 1];
    const line3 = rawLines[i + 2];

    const hasTableBlock =
      line2 !== undefined &&
      isMarkdownTableSeparator(line2) &&
      line3 !== undefined &&
      isPipeTableRow(line3) &&
      !isMarkdownTableSeparator(line3);

    if (hasTableBlock) {
      const tableLines: string[] = [];
      let start = i;

      if (
        isPipeTableRow(line) &&
        !isMarkdownTableSeparator(line) &&
        !isTableCaptionRow(line)
      ) {
        tableLines.push(line, line2);
        start = i + 2;
      } else {
        if (line.trim()) out.push(line.trim());
        tableLines.push(line2);
        start = i + 2;
      }

      let j = start;
      while (j < rawLines.length) {
        const L = rawLines[j] ?? "";
        if (!L.trim()) break;
        if (isPipeTableRow(L)) {
          tableLines.push(L);
          j++;
        } else break;
      }

      const colCount = Math.max(
        ...tableLines.map((l) => splitPipeCells(l).length),
        2
      );
      const parsed = parsePipeTableBlock(tableLines.join("\n"), colCount);
      if (parsed) {
        out.push("[TABLE]");
        out.push(`| ${parsed.headers.join(" | ")} |`);
        out.push(`| ${parsed.headers.map(() => "---").join(" | ")} |`);
        for (const row of parsed.rows) {
          out.push(`| ${row.join(" | ")} |`);
        }
        out.push("[/TABLE]");
      } else {
        out.push(...rawLines.slice(i, j));
      }
      i = j;
      continue;
    }

    out.push(line);
    i++;
  }

  return out.join("\n");
}

export function parsePipeTableBlock(
  block: string,
  expectedCols?: number
): { headers: string[]; rows: string[][] } | null {
  const lines = block
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  const sepIdx = lines.findIndex(isMarkdownTableSeparator);
  if (sepIdx >= 0) {
    const colCount = expectedCols ?? splitPipeCells(lines[sepIdx]).length;
    let headers: string[];
    let dataStart = sepIdx + 1;

    const prev = sepIdx > 0 ? lines[sepIdx - 1] : "";
    if (
      prev &&
      isPipeTableRow(prev) &&
      !isMarkdownTableSeparator(prev) &&
      !isTableCaptionRow(prev)
    ) {
      const h = splitPipeCells(prev).map(
        (c, i) => c || (defaultHeaders(colCount)[i] ?? `Column ${i + 1}`)
      );
      headers = padRow(h, colCount);
      dataStart = sepIdx + 1;
    } else {
      headers = defaultHeaders(colCount);
      dataStart = sepIdx + 1;
    }

    const rows: string[][] = [];
    for (let j = dataStart; j < lines.length; j++) {
      if (isMarkdownTableSeparator(lines[j])) continue;
      const row = splitPipeCells(lines[j]);
      if (row.some((c) => c.length > 0)) rows.push(padRow(row, colCount));
    }
    return rows.length > 0 ? { headers, rows } : null;
  }

  const headers = splitPipeCells(lines[0]).map((c, i) => c || defaultHeaders(splitPipeCells(lines[0]).length)[i]);
  if (headers.length < 2) return null;

  const rows: string[][] = [];
  for (let j = 1; j < lines.length; j++) {
    if (isMarkdownTableSeparator(lines[j])) continue;
    const row = splitPipeCells(lines[j]);
    if (row.some((c) => c.length > 0)) rows.push(padRow(row, headers.length));
  }
  return rows.length > 0 ? { headers, rows } : null;
}
