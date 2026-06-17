import { Logger } from "../utils/Logger";

// ── helpers ────────────────────────────────────────────────────────────────

function captureNext(): Promise<string> {
  return new Promise((resolve) => {
    const original = process.stdout.write.bind(process.stdout);
    (process.stdout.write as any) = (data: string) => {
      process.stdout.write = original;
      resolve(data.trim());
    };
  });
}

function parsed(line: string): Record<string, unknown> {
  try { return JSON.parse(line); } catch { return {}; }
}

// ══════════════════════════════════════════════════════════════════════════════
// AC-1: JSON format + mandatory fields
// ══════════════════════════════════════════════════════════════════════════════

describe("Logger — format (AC-1 / AC-2 / AC-3)", () => {
  it("AC-1: output is valid JSON with level, timestamp, msg", async () => {
    const p = captureNext();
    Logger.info("hello");
    const obj = parsed(await p);
    expect(obj.level).toBe("info");
    expect(typeof obj.timestamp).toBe("string");
    expect(new Date(obj.timestamp as string).toISOString()).toBe(obj.timestamp);
    expect(obj.msg).toBe("hello");
  });

  it("AC-2: game log includes roomId when provided", async () => {
    const p = captureNext();
    Logger.info("test", { roomId: "room1" });
    expect((parsed(await p)).roomId).toBe("room1");
  });

  it("AC-2: user log includes userId when provided", async () => {
    const p = captureNext();
    Logger.info("test", { userId: 42 });
    expect((parsed(await p)).userId).toBe(42);
  });

  it("AC-3: level values are debug/info/warn/error", async () => {
    for (const level of ["info", "warn", "error"] as const) {
      const p = captureNext();
      Logger[level]("msg");
      expect((parsed(await p)).level).toBe(level);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC-4: production suppresses DEBUG
// ══════════════════════════════════════════════════════════════════════════════

describe("Logger — level filtering (AC-4 / AC-5)", () => {
  it("AC-4: DEBUG not output when NODE_ENV=production", () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const spy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    Logger.debug("should be suppressed");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    process.env.NODE_ENV = orig;
  });

  it("AC-4: DEBUG outputs normally in development", async () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    const p = captureNext();
    Logger.debug("visible");
    const obj = parsed(await p);
    expect(obj.level).toBe("debug");
    process.env.NODE_ENV = orig;
  });

  it("AC-5: Logger writes to process.stdout (not console.log)", () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const stdoutSpy  = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    Logger.info("test");
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(stdoutSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
    stdoutSpy.mockRestore();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC-6 … AC-12  Business event fields
// ══════════════════════════════════════════════════════════════════════════════

describe("Logger — business events (AC-6 … AC-12)", () => {
  it("AC-6: login event fields", async () => {
    const p = captureNext();
    Logger.info("login", { event: "login", userId: 1, platform: "wechat" });
    const obj = parsed(await p);
    expect(obj.event).toBe("login");
    expect(obj.userId).toBe(1);
    expect(obj.platform).toBe("wechat");
  });

  it("AC-7: match_start event fields", async () => {
    const p = captureNext();
    Logger.info("match_start", { event: "match_start", userId: 2, tier: "tier_1" });
    const obj = parsed(await p);
    expect(obj.event).toBe("match_start");
    expect(obj.tier).toBe("tier_1");
  });

  it("AC-8: game_start event fields", async () => {
    const p = captureNext();
    Logger.info("game_start", { event: "game_start", roomId: "r1", landlordId: "p0", isLandlordAlone: false });
    const obj = parsed(await p);
    expect(obj.event).toBe("game_start");
    expect(obj.landlordId).toBe("p0");
  });

  it("AC-9: game_end event fields", async () => {
    const p = captureNext();
    Logger.info("game_end", { event: "game_end", roomId: "r1", winnerCamp: 1, duration: 480, multiplier: 4 });
    const obj = parsed(await p);
    expect(obj.event).toBe("game_end");
    expect(obj.multiplier).toBe(4);
    expect(obj.duration).toBe(480);
  });

  it("AC-10: play_error event fields", async () => {
    const p = captureNext();
    Logger.warn("play_error", { event: "play_error", roomId: "r1", userId: 5, errorCode: 1001 });
    const obj = parsed(await p);
    expect(obj.event).toBe("play_error");
    expect(obj.errorCode).toBe(1001);
  });

  it("AC-11: db_error ERROR level with error message", async () => {
    const p = captureNext();
    Logger.error("db_error", { event: "db_error", roomId: "r1", error: new Error("Deadlock found") });
    const obj = parsed(await p);
    expect(obj.level).toBe("error");
    expect(obj.error).toBe("Deadlock found");
  });

  it("AC-12: error includes stack trace", async () => {
    const p = captureNext();
    const err = new Error("boom");
    Logger.error("crash", { error: err });
    const obj = parsed(await p);
    expect(typeof obj.stack).toBe("string");
    expect((obj.stack as string).length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AC-13 / AC-14  stdout + 4 KB truncation
// ══════════════════════════════════════════════════════════════════════════════

describe("Logger — output destination and size (AC-13 / AC-14)", () => {
  it("AC-13: writes to process.stdout", () => {
    const spy = jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    Logger.info("stdout test");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("AC-14: output does not exceed 4096 bytes", async () => {
    const p = captureNext();
    const longStack = "x".repeat(8000);
    const err = new Error("big");
    err.stack = longStack;
    Logger.error("big error", { error: err });
    const line = await p;
    expect(line.length).toBeLessThanOrEqual(4096);
  });

  it("AC-14: normal log with large context is truncated", async () => {
    const p = captureNext();
    Logger.info("large ctx", { data: "a".repeat(5000) });
    const line = await p;
    expect(line.length).toBeLessThanOrEqual(4096);
  });
});
