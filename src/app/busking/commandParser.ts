/**
 * ETC EOS-style command parser for busking.
 * Parses: [Fixture ]n [Thru m | -m | ,a,b,c] at|@ <level> | Full | On | Off [color <presetName>]
 * Ranges: "1 Thru 10" or "1-10". Lists: "1,2,5,6".
 * Case-insensitive. "Fixture " is optional if line starts with a number.
 * Also accepts "Chan" as alias for "Fixture". "@" is shorthand for "at".
 */

export interface ParsedCommand {
  fixtureNumbers: number[];
  level: number | null; // 0-100 percent, null means use default
  off: boolean;
  colorName?: string | null;
  error?: string;
}

function dedupeOrdered(nums: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const n of nums) {
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

function expandRange(first: number, last: number): number[] {
  const fixtureNumbers: number[] = [];
  for (let i = first; i <= last; i++) fixtureNumbers.push(i);
  return fixtureNumbers;
}

/**
 * Parse fixture list after "Fixture " / "Chan ". Returns consumed rest of line after fixture spec.
 */
function parseFixtureSpec(rest: string): { fixtureNumbers: number[]; rest: string } | { error: string } {
  // 1. Comma-separated list (requires at least one comma)
  const commaMatch = rest.match(/^(\d+(?:\s*,\s*\d+)+)/);
  if (commaMatch) {
    const raw = commaMatch[1] ?? "";
    const parts = raw.split(/\s*,\s*/);
    const nums: number[] = [];
    for (const p of parts) {
      const n = parseInt(p, 10);
      if (!Number.isFinite(n) || n < 1) {
        return { error: "Fixture numbers must be positive integers" };
      }
      nums.push(n);
    }
    return { fixtureNumbers: dedupeOrdered(nums), rest: rest.slice(commaMatch[0].length).trim() };
  }

  // 2. "Thru" range
  const thruMatch = rest.match(/^(\d+)\s+thru\s+(\d+)/i);
  if (thruMatch) {
    const firstNum = parseInt(thruMatch[1] ?? "0", 10);
    const lastNum = parseInt(thruMatch[2] ?? "0", 10);
    if (firstNum < 1) {
      return { error: "Fixture numbers must be positive integers" };
    }
    if (lastNum < firstNum) {
      return { error: "Thru number must be >= first fixture" };
    }
    return {
      fixtureNumbers: expandRange(firstNum, lastNum),
      rest: rest.slice(thruMatch[0].length).trim(),
    };
  }

  // 3. Hyphen range (e.g. 1-10)
  const hyphenMatch = rest.match(/^(\d+)\s*-\s*(\d+)/);
  if (hyphenMatch) {
    const firstNum = parseInt(hyphenMatch[1] ?? "0", 10);
    const lastNum = parseInt(hyphenMatch[2] ?? "0", 10);
    if (firstNum < 1) {
      return { error: "Fixture numbers must be positive integers" };
    }
    if (lastNum < firstNum) {
      return { error: "Range end must be >= first fixture" };
    }
    return {
      fixtureNumbers: expandRange(firstNum, lastNum),
      rest: rest.slice(hyphenMatch[0].length).trim(),
    };
  }

  // 4. Single fixture number
  const singleMatch = rest.match(/^(\d+)/);
  if (!singleMatch) {
    return { error: "Expected fixture number(s) after Fixture/Chan" };
  }
  const n = parseInt(singleMatch[1] ?? "0", 10);
  if (n < 1) {
    return { error: "Fixture numbers must be positive integers" };
  }
  return { fixtureNumbers: [n], rest: rest.slice(singleMatch[0].length).trim() };
}

/**
 * Parse a single line into fixture numbers and action (at/@ level / Full / Off).
 * Returns null if the line doesn't match the expected format.
 */
export function parseBuskingCommand(line: string): ParsedCommand | null {
  let trimmed = line.trim();
  if (!trimmed) return null;

  // If line starts with a digit, treat as "Fixture <rest>"
  if (/^\d/.test(trimmed)) {
    trimmed = "Fixture " + trimmed;
  }

  const fixtureKeywordMatch = trimmed.match(/^(?:fixture|chan)\s+/i);
  if (!fixtureKeywordMatch) return null;

  let rest = trimmed.slice(fixtureKeywordMatch[0].length).trim();
  const spec = parseFixtureSpec(rest);
  if ("error" in spec) {
    return { fixtureNumbers: [], off: false, level: null, error: spec.error };
  }
  const { fixtureNumbers } = spec;
  rest = spec.rest;

  // Optional "color <name>" suffix (name may contain spaces)
  let colorName: string | null = null;
  const colorMatch = rest.match(/^(.*?)(?:\s+color\s+)(.+)$/i);
  if (colorMatch) {
    rest = (colorMatch[1] ?? "").trim();
    colorName = (colorMatch[2] ?? "").trim();
    if (!colorName) {
      return { fixtureNumbers: [], off: false, level: null, colorName: null, error: "Color name missing after 'color'" };
    }
  }

  // "at <number>", "@ <number>", "full", "on", or "off"
  const atMatch = rest.match(/^\s*(?:at|@)\s*(\d+)\s*$/i);
  const fullMatch = /^\s*full\s*$/i.test(rest);
  const onMatch = /^\s*on\s*$/i.test(rest);
  const offMatch = /^\s*off\s*$/i.test(rest);

  if (atMatch) {
    const pct = parseInt(atMatch[1], 10);
    if (pct < 0 || pct > 100) {
      return { fixtureNumbers: [], off: false, level: null, colorName, error: "Level must be 0-100" };
    }
    return { fixtureNumbers, level: pct, off: false, colorName };
  }
  if (fullMatch || onMatch) {
    return { fixtureNumbers, level: 100, off: false, colorName };
  }
  if (offMatch) {
    return { fixtureNumbers, level: 0, off: true, colorName };
  }

  return null;
}
