import { describe, expect, it } from "vitest";
import { parseLocalArchive, relayAvailability } from "./safety";

const now = Date.parse("2026-11-06T00:00:00Z");
const base = {
    allowed: true,
    source: "real" as const,
    relay: { is_enabled: true, channel: 1 },
    device: { is_active: true, connectivity_status: "online", last_seen_at: "2026-11-05T23:59:50Z", stale_after_seconds: 120, device_type: "esp32", firmware_version: "3.1" },
    now,
};

describe("manual relay UI safety boundary", () => {
    it("allows a fresh registered single output only with explicit capability", () => {
        expect(relayAvailability(base).allowed).toBe(true);
        expect(relayAvailability({ ...base, allowed: false }).allowed).toBe(false);
    });
    it("rejects unknown, stale and future heartbeats despite online label", () => {
        for (const last_seen_at of [null, "invalid", "2026-11-05T23:55:00Z", "2026-11-06T00:01:00Z"]) {
            expect(relayAvailability({ ...base, device: { ...base.device, last_seen_at } }).allowed).toBe(false);
        }
    });
    it("rejects disabled devices, unsupported firmware and an invented second output", () => {
        expect(relayAvailability({ ...base, device: { ...base.device, is_active: false } }).allowed).toBe(false);
        expect(relayAvailability({ ...base, device: { ...base.device, firmware_version: "unknown" } }).allowed).toBe(false);
        expect(relayAvailability({ ...base, relay: { ...base.relay, channel: 2 } }).allowed).toBe(false);
    });
    it("does not retry while server command is still awaiting outcome", () => {
        for (const status of ["queued", "requested", "published"]) {
            expect(relayAvailability({ ...base, command: { status } }).allowed).toBe(false);
        }
        expect(relayAvailability({ ...base, command: { status: "timed_out" } }).allowed).toBe(true);
    });
});

describe("explicit browser archive preview", () => {
    it("keeps local identities as preview data without producing server mutations", () => {
        const preview = parseLocalArchive(JSON.stringify({ app: "coasther", data: { coasther_daily_records_9: [{ date: "2026-11-05", dead: 1 }] } }));
        expect(preview.entries.map(({ key, count }) => ({ key, count }))).toEqual([{ key: "coasther_daily_records_9", count: 1 }]);
    });
    it("rejects cookie/session keys and unknown imported namespaces", () => {
        for (const key of ["coasther_token", "coasther_user", "coasther-demo-db", "__proto__", "other-app"]) {
            expect(() => parseLocalArchive(JSON.stringify({ app: "coasther", data: { [key]: "not-imported" } }))).toThrow();
        }
    });
    it("rejects null/array archives and oversized previews", () => {
        for (const data of [null, [], "text"]) expect(() => parseLocalArchive(JSON.stringify({ app: "coasther", data }))).toThrow();
        expect(() => parseLocalArchive(" ".repeat(5_000_001))).toThrow(/5 MB/);
    });
});
