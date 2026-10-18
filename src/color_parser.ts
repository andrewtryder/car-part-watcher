export interface ParsedColor {
  /** Normalized canonical color family (e.g. "Black", "Silver", "Gray", "White", "Blue", "Red", "Maroon", etc.) */
  color: string;
  /** Paint code if detected (e.g. "NH731P", "B588P", "NH830M", "R548PX") */
  code?: string;
  /** Exact text or token matched from description */
  raw: string;
}

// Common automotive OEM Paint Code dictionary mapping to canonical color names
const PAINT_CODE_MAP: Record<string, { color: string; name?: string }> = {
  // Honda / Acura
  "NH731P": { color: "Black", name: "Crystal Black Pearl" },
  "NH830M": { color: "Silver", name: "Lunar Silver Metallic" },
  "NH830MX": { color: "Silver", name: "Lunar Silver Metallic" },
  "830MX": { color: "Silver", name: "Lunar Silver Metallic" },
  "NH700M": { color: "Silver", name: "Alabaster Silver Metallic" },
  "NH797M": { color: "Gray", name: "Modern Steel Metallic" },
  "NH797MX": { color: "Gray", name: "Modern Steel Metallic" },
  "797MX": { color: "Gray", name: "Modern Steel Metallic" },
  "NH737M": { color: "Gray", name: "Polished Metal Metallic" },
  "NH603P": { color: "White", name: "White Diamond Pearl" },
  "NH883P": { color: "White", name: "Platinum White Pearl" },
  "NH578": { color: "White", name: "Taffeta White" },
  "B588P": { color: "Blue", name: "Obsidian Blue Pearl" },
  "B607M": { color: "Blue", name: "Cosmic Blue Metallic" },
  "B553P": { color: "Blue", name: "Vortex Blue Pearl" },
  "PB88M": { color: "Black", name: "Midnight Blue Beam Metallic" },
  "PB88MX": { color: "Black", name: "Midnight Blue Beam Metallic" },
  "R548P": { color: "Maroon", name: "Basque Red Pearl II" },
  "R548PX": { color: "Maroon", name: "Basque Red Pearl II" },
  "548PX": { color: "Maroon", name: "Basque Red Pearl II" },
  "R539P": { color: "Red", name: "Passion Red Pearl" },
  "R539PX": { color: "Red", name: "Passion Red Pearl" },
  "R569M": { color: "Red", name: "Radiant Red Metallic" },
  "R81": { color: "Red", name: "Milano Red" },
  "G546M": { color: "Green", name: "Dark Olive Metallic" },
  "546M": { color: "Green", name: "Dark Olive Metallic" },
  "YR620M": { color: "Beige", name: "Sandstorm Metallic" },
  "YR620MX": { color: "Beige", name: "Sandstorm Metallic" },
  "YR600M": { color: "Brown", name: "Kona Coffee Metallic" },
  // Common 2-letter recycler paint codes (e.g. PC=BK, PAINT: RB)
  "BK": { color: "Black" },
  "WH": { color: "White" },
  "SI": { color: "Silver" },
  "GY": { color: "Gray" },
  "BL": { color: "Blue" },
  "RD": { color: "Red" },
  "RB": { color: "Maroon" },
  "GN": { color: "Green" },
};

const MULTI_WORD_PATTERNS: Array<{ re: RegExp; color: string; raw: string }> = [
  { re: /\bgun\s*metal(?:lic)?\b/i, color: "Gray", raw: "Gun Metal" },
  { re: /\bmodern\s*steel\b/i, color: "Gray", raw: "Modern Steel" },
  { re: /\blunar\s*silver\b/i, color: "Silver", raw: "Lunar Silver" },
  { re: /\bcrystal\s*black\b/i, color: "Black", raw: "Crystal Black" },
  { re: /\bwhite\s*diamond\b/i, color: "White", raw: "White Diamond" },
  { re: /\bplatinum\s*white\b/i, color: "White", raw: "Platinum White" },
  { re: /\bobsidian\s*blue\b/i, color: "Blue", raw: "Obsidian Blue" },
  { re: /\bcosmic\s*blue\b/i, color: "Blue", raw: "Cosmic Blue" },
  { re: /\bmidnight\s*blue\b/i, color: "Blue", raw: "Midnight Blue" },
  { re: /\bruby\s*red\b/i, color: "Red", raw: "Ruby Red" },
  { re: /\bpassion\s*red\b/i, color: "Red", raw: "Passion Red" },
  { re: /\bbasque\s*red\b/i, color: "Maroon", raw: "Basque Red" },
  { re: /\bdark\s*olive\b/i, color: "Green", raw: "Dark Olive" },
];

export function mapColorWord(word: string): string | null {
  const w = word.toLowerCase().trim();
  switch (w) {
    case "black":
    case "blk":
    case "bk":
      return "Black";
    case "white":
    case "wht":
    case "wh":
      return "White";
    case "silver":
    case "slv":
    case "silv":
    case "sil":
    case "syvler":
    case "si":
      return "Silver";
    case "gray":
    case "grey":
    case "gry":
    case "gy":
    case "char":
    case "charcoal":
      return "Gray";
    case "blue":
    case "blu":
    case "bl":
    case "blueish":
    case "teal":
    case "navy":
      return "Blue";
    case "red":
    case "rd":
    case "redish":
    case "reddish":
    case "crimson":
      return "Red";
    case "maroon":
    case "mar":
    case "mrn":
    case "burgundy":
      return "Maroon";
    case "green":
    case "grn":
    case "gn":
    case "olive":
      return "Green";
    case "beige":
    case "bei":
    case "tan":
    case "sandstorm":
      return "Beige";
    case "brown":
    case "brn":
      return "Brown";
    case "gold":
    case "gld":
    case "bronze":
    case "copper":
      return "Gold";
    case "yellow":
    case "yel":
      return "Yellow";
    case "orange":
    case "org":
      return "Orange";
    case "purple":
    case "ple":
    case "plum":
      return "Purple";
    case "primered":
    case "primer":
    case "unpainted":
      return "Primered";
    default:
      return null;
  }
}

/**
 * Extracts and normalizes vehicle color and paint codes from listing description.
 */
export function parseListingColor(
  description?: string | null,
): ParsedColor | undefined {
  if (!description) return undefined;
  const rawDesc = description.trim();
  if (!rawDesc) return undefined;

  // 1. Check for explicit paint code label (e.g. "PAINT CODE NH731P", "PC-548PX", "SLV-NH830M", "B588P")
  const paintCodeRegex =
    /\b(?:paint(?:\s*code)?(?:\s*is)?[:\s=-]*|pc[:\s=-]*|paint[:\s=]*)([a-z0-9]{2,10})\b/i;
  const pcMatch = rawDesc.match(paintCodeRegex);
  if (pcMatch) {
    const code = pcMatch[1].toUpperCase();
    if (PAINT_CODE_MAP[code]) {
      return {
        color: PAINT_CODE_MAP[code].color,
        code,
        raw: pcMatch[0],
      };
    }
  }

  // Check embedded paint code patterns like "(NH830M)", "NH731P", "R539PX", etc.
  const embeddedCodeMatch = rawDesc.match(
    /\b([A-Z]{1,2}\d{3}[A-Z]{0,2}|(?:NH|YR|PB|B|R|G)\d{3}[A-Z]{0,2})\b/i,
  );
  if (embeddedCodeMatch) {
    const code = embeddedCodeMatch[1].toUpperCase();
    if (PAINT_CODE_MAP[code]) {
      return {
        color: PAINT_CODE_MAP[code].color,
        code,
        raw: embeddedCodeMatch[0],
      };
    }
  }

  // 2. Multi-word / OEM color phrases (e.g. "Modern Steel", "Gun Metal", "Lunar Silver")
  for (const item of MULTI_WORD_PATTERNS) {
    if (item.re.test(rawDesc)) {
      return { color: item.color, raw: item.raw };
    }
  }

  // 3. Two-tone or directional indicator: "BLUE UP BLACK LOW", "SILVER UPONLY"
  const upLowMatch = rawDesc.match(
    /\b(blue|blueish|white|silver|gray|grey|red|redish|black|maroon)\s+(?:up|upper|only)\b/i,
  );
  if (upLowMatch) {
    const mapped = mapColorWord(upLowMatch[1]);
    if (mapped) return { color: mapped, raw: upLowMatch[0] };
  }

  // 4. Token-based matching: split by punctuation and whitespace
  // Recyclers frequently mention textured unpainted plastic (e.g., "BLK TXT", "BLK TEXTURED", "W/BLK LWR TEX").
  // Strip out the plastic reference first to ensure the painted body color takes precedence.
  const sanitized = rawDesc.replace(
    /\b(?:blk|black)\s*(?:txt|tex|textured|texture|lower|skid|valance|grille?|plastic)\b/gi,
    " ",
  );
  const tokens = sanitized
    .split(/[\s,./()#\-_*';]+/)
    .filter(Boolean);

  for (const token of tokens) {
    const mapped = mapColorWord(token);
    if (mapped) {
      return { color: mapped, raw: token };
    }
  }

  // 5. Fallback check for standalone black if not superseded by another body color
  const fallbackBlack = rawDesc.match(/\b(black|blk)\b/i);
  if (fallbackBlack) {
    return { color: "Black", raw: fallbackBlack[0] };
  }

  return undefined;
}
