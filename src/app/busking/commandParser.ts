/**
 * ETC EOS-style command parser for busking.
 * Parses: [Fixture ]n [Thru m] at|@ <level> | Full | On | Off [color <presetName>]
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

  const lower = trimmed.toLowerCase();

  // Match "fixture" or "chan" followed by number
  const fixtureMatch = lower.match(/^(?:fixture|chan)\s+(\d+)/);
  if (!fixtureMatch) return null;

  const firstNum = parseInt(fixtureMatch[1], 10);
  if (firstNum < 1) return null;

  let fixtureNumbers: number[] = [firstNum];
  let rest = trimmed.slice(fixtureMatch[0].length).trim();

  // Optional "Thru n"
  const thruMatch = rest.match(/^\s*thru\s+(\d+)/i);
  if (thruMatch) {
    const lastNum = parseInt(thruMatch[1], 10);
    if (lastNum < firstNum) {
      return { fixtureNumbers: [], off: false, level: null, error: "Thru number must be >= first fixture" };
    }
    fixtureNumbers = [];
    for (let i = firstNum; i <= lastNum; i++) fixtureNumbers.push(i);
    rest = rest.slice(thruMatch[0].length).trim();
  }

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
