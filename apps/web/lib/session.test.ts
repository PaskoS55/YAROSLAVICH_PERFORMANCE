import { beforeEach, describe, expect, it } from "vitest";
import { createDemoCapability, createSession, readDemoCapability, readSession, verifySession } from "./session";
describe("auth session v1", () => {
  beforeEach(() => {
    process.env.AUTH_SESSION_SECRET =
      "test-only-session-secret-with-more-than-32-bytes";
  });
  it("signs identity and bounded expiry", async () => {
    const token = await createSession("user-1", 1000);
    expect((await readSession(token, 2000))?.userId).toBe("user-1");
    expect(await verifySession(`${token}x`)).toBe(false);
  });
  it("rejects expiry and malformed values", async () => {
    const token = await createSession("user-1", 1000);
    expect(await readSession(token, 1000 + 12 * 60 * 60 * 1000)).toBeNull();
    expect(await readSession("broken")).toBeNull();
  });
  it('keeps demo capability narrow, signed and short-lived', async () => {
    const capability = await createDemoCapability('user-1', 1000);
    expect((await readDemoCapability(capability, 2000))?.userId).toBe('user-1');
    expect(await readSession(capability, 2000)).toBeNull();
    expect(await readDemoCapability(`${capability}x`, 2000)).toBeNull();
    expect(await readDemoCapability(capability, 1000 + 30 * 60 * 1000)).toBeNull();
  });
});
