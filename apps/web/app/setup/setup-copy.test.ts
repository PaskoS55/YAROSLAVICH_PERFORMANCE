import { describe, expect, it } from "vitest";
import { SETUP_COPY } from "./setup-copy";

describe("first-run product language", () => {
  it("uses the user-facing product name and natural completion language", () => {
    expect(SETUP_COPY.welcomeTitle).toBe("Добро пожаловать в PASKO Performance");
    expect(SETUP_COPY.completeTitle).toBe("Всё готово");
    expect(SETUP_COPY.completeSubtitle).toBe("Платформа настроена и готова к работе.");
    expect(Object.values(SETUP_COPY).join(" ")).not.toContain("PASKO настроен");
  });
});
