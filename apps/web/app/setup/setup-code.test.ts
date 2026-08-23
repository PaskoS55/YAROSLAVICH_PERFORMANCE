import { describe, expect, it } from "vitest";
import { codeBase, uniqueCode } from "./setup-code";

describe("first-run internal codes", () => {
  it("generates ASCII-safe codes from Russian names", () => {
    expect(codeBase("ВК Ярославич", "ORG")).toBe("VK-YAROSLAVICH");
    expect(codeBase("Основной состав", "TEAM")).toBe("OSNOVNOY-SOSTAV");
  });

  it("uses a safe fallback and deterministic collision suffix", async () => {
    expect(codeBase("🏐", "TEAM")).toBe("TEAM");
    expect(await uniqueCode("TEAM", async (value) => value === "TEAM")).toBe("TEAM-2");
  });
});
