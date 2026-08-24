const TRANSLITERATION: Record<string, string> = {
  А: "A", Б: "B", В: "V", Г: "G", Д: "D", Е: "E", Ё: "E", Ж: "ZH",
  З: "Z", И: "I", Й: "Y", К: "K", Л: "L", М: "M", Н: "N", О: "O",
  П: "P", Р: "R", С: "S", Т: "T", У: "U", Ф: "F", Х: "KH", Ц: "TS",
  Ч: "CH", Ш: "SH", Щ: "SCH", Ъ: "", Ы: "Y", Ь: "", Э: "E",
  Ю: "YU", Я: "YA",
};

export function codeBase(name: string, fallback: string): string {
  const transliterated = Array.from(name.trim().toUpperCase())
    .map((character) => TRANSLITERATION[character] ?? character)
    .join("");
  const normalized = transliterated
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28)
    .replace(/-+$/g, "");
  return normalized || fallback;
}

export async function uniqueCode(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  for (let suffix = 1; suffix <= 9999; suffix += 1) {
    const ending = suffix === 1 ? "" : `-${suffix}`;
    const candidate = `${base.slice(0, 32 - ending.length)}${ending}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error("CODE_SPACE_EXHAUSTED");
}
