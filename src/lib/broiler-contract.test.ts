import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { isAxiosError } from "axios";
import { api } from "./api";
import { login } from "./auth-api";
import { allPages, kwhToWh, litersToM3, metric, queryScope, readData, stream, wattsToKw, writeData, type Live, type Summary } from "./broiler-api";

const auth = vi.hoisted(() => ({ clear: vi.fn(), token: "synthetic-fixture-bearer" }));
vi.mock("./auth", () => ({ getToken: () => auth.token, clearAuth: auth.clear }));

type Received = { method: string; path: string; body: unknown; authorization?: string };
const received: Received[] = [];
const metricFields: Live = { source: "sensor", status: "stale", recorded_at: "2026-11-05T15:00:00Z", flow_rate_lpm: null, water_total_liter: null, voltage_v: null, current_a: null, power_w: null, energy_kwh_total: null, frequency_hz: null, power_factor: null, field_status: { power_w: "stale", flow_rate_lpm: "no_data" } };
const fixtureSummary: Summary = {
    state: "ready",
    coop: { id: 41, farm_id: 22, name: "Fixture coop", code: "FIXTURE", status: "active" },
    active_cycle: { id: 88, coop_id: 41, cycle_code: "FIXTURE-CYCLE", status: "active", initial_population: 100, current_population: 100, day_age: 1, placement_date: "2026-11-06" },
    devices: [],
    live: metricFields,
    today: { water_liters: 0, energy_kwh: 0, energy_wh_per_bird: 0, population_basis: 100, status: "partial", source: "real" },
    cycle_totals: { water_liters: 1500, energy_kwh: 2, energy_wh_per_bird: 20, population_basis: 100, status: "partial", source: "real" },
    simulation: { live: { ...metricFields, source: "simulation", status: "live", power_w: 500, water_total_liter: 1500, energy_kwh_total: 2 }, today: { water_liters: 500, energy_kwh: 2, energy_wh_per_bird: 20, source: "simulation", status: "partial" }, cycle_totals: null },
};
let server: Server;
let originalBase: string | undefined;
let originalProxy: typeof api.defaults.proxy;

beforeAll(async () => {
    originalBase = api.defaults.baseURL;
    originalProxy = api.defaults.proxy;
    server = createServer(async (request, response) => {
        const url = new URL(request.url ?? "/", "http://fixture.invalid");
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        const raw = Buffer.concat(chunks).toString();
        const body: unknown = raw ? JSON.parse(raw) : null;
        received.push({ method: request.method ?? "GET", path: request.url ?? "/", body, authorization: request.headers.authorization });
        response.setHeader("content-type", "application/json");
        const send = (data: unknown, status = 200) => { response.statusCode = status; response.end(JSON.stringify({ success: true, message: "Fixture only", data })); };
        if (url.pathname.startsWith("/api/fixture/errors/")) {
            response.statusCode = Number(url.pathname.split("/").at(-1));
            response.end(JSON.stringify({ success: false, message: `fixture_${response.statusCode}` }));
        } else if (url.pathname === "/api/auth/login") {
            send({ token: "synthetic-login-response", user: { id: 3, name: "Fixture operator", role: "operator", email: "operator@example.invalid" } });
        } else if (url.pathname === "/api/dashboard/summary") {
            send(fixtureSummary);
        } else if (url.pathname === "/api/coops") {
            const page = Number(url.searchParams.get("page"));
            send({ coops: page === 1 ? Array.from({ length: 100 }, (_, index) => ({ id: index + 1 })) : [{ id: 101 }] });
        } else if (url.pathname === "/api/ai/copilot") {
            send({ state: "unavailable", reason: "not_configured", retryable: false, source: "simulation" });
        } else if (url.pathname === "/api/meters/7" && request.method === "PATCH") {
            send({ meter: { id: 7, is_active: false } });
        } else {
            response.statusCode = 501;
            response.end(JSON.stringify({ success: false, message: "Fixture endpoint is not defined" }));
        }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    api.defaults.baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    api.defaults.proxy = false;
});

beforeEach(() => { received.length = 0; auth.clear.mockClear(); vi.unstubAllGlobals(); });
afterAll(async () => { api.defaults.baseURL = originalBase; api.defaults.proxy = originalProxy; vi.unstubAllGlobals(); server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

describe("frontend wire contract through actual local HTTP", () => {
    it("serializes only email/password even when rememberMe is set", async () => {
        const session = await login({ email: "operator@example.invalid", password: "fixture-only-password", rememberMe: true });
        expect(received).toHaveLength(1);
        expect(received[0]).toMatchObject({ method: "POST", path: "/api/auth/login", body: { email: "operator@example.invalid", password: "fixture-only-password" } });
        expect(Object.keys(received[0].body as object).sort()).toEqual(["email", "password"]);
        expect(session.user.role).toBe("operator");
    });

    it("attaches synthetic bearer only in headers and preserves query parameters", async () => {
        await readData<Summary>("/api/dashboard/summary", { coop_id: 41, include_simulation: true });
        const url = new URL(received[0].path, "http://fixture.invalid");
        expect(received[0].authorization).toBe(`Bearer ${auth.token}`);
        expect(url.searchParams.get("coop_id")).toBe("41");
        expect(url.searchParams.get("include_simulation")).toBe("true");
        expect(received[0].path).not.toContain(auth.token);
    });

    it.each([400, 403, 404, 409, 429, 500, 503])("propagates HTTP %i without returning fabricated data", async (status) => {
        try { await readData(`/api/fixture/errors/${status}`); throw new Error("Expected HTTP failure"); }
        catch (error) { expect(isAxiosError(error)).toBe(true); if (isAxiosError(error)) { expect(error.response?.status).toBe(status); expect(error.response?.data.message).toBe(`fixture_${status}`); } }
        expect(received).toHaveLength(1);
        expect(auth.clear).not.toHaveBeenCalled();
    });

    it("clears session and dispatches unauthorized on an HTTP401 response", async () => {
        const browser = new EventTarget(); const handler = vi.fn(); browser.addEventListener("coasther:unauthorized", handler); vi.stubGlobal("window", browser);
        await expect(readData("/api/fixture/errors/401")).rejects.toMatchObject({ response: { status: 401 } });
        expect(auth.clear).toHaveBeenCalledOnce(); expect(handler).toHaveBeenCalledOnce();
    });

    it("keeps a caller's patch method/body and does not retry writes", async () => {
        await writeData("patch", "/api/meters/7", { is_active: false });
        expect(received).toHaveLength(1);
        expect(received[0]).toMatchObject({ method: "PATCH", path: "/api/meters/7", body: { is_active: false } });
    });

    it("leaves HTTP200 Copilot unavailable distinct from ready content", async () => {
        const unavailable = await writeData<{ state: string; reason: string; retryable: boolean; message?: unknown }>("post", "/api/ai/copilot", { coop_id: 41, source: "simulation", message: "Fixture context question", request_id: "00000000-0000-4000-8000-000000000001" });
        expect(unavailable).toMatchObject({ state: "unavailable", reason: "not_configured", retryable: false });
        expect(unavailable.message).toBeUndefined();
    });

    it("consumes all bounded pages without relying on invented total counts", async () => {
        const coops = await allPages<{ id: number }>("/api/coops", "coops");
        expect(coops).toHaveLength(101);
        expect(coops.at(-1)?.id).toBe(101);
        expect(received.map((row) => new URL(row.path, "http://fixture.invalid").searchParams.get("page"))).toEqual(["1", "2"]);
    });

    it("does not fall back to an in-browser mock for unknown requests", async () => {
        await expect(readData("/api/rooms/all")).rejects.toMatchObject({ response: { status: 501 } });
        expect(received[0].path).toBe("/api/rooms/all");
    });
});

describe("canonical server metric and context boundaries", () => {
    it("keeps real null/stale separate from populated simulation and preserves accepted-zero", async () => {
        const summary = await readData<Summary>("/api/dashboard/summary", { coop_id: 41, include_simulation: true });
        expect(stream(summary, "real")?.live.power_w).toBeNull();
        expect(stream(summary, "real")?.live.field_status.power_w).toBe("stale");
        expect(stream(summary, "simulation")?.live.power_w).toBe(500);
        expect(metric(stream(summary, "real")?.today?.energy_kwh, 2, " kWh")).toBe("0 kWh");
        expect(metric(stream(summary, "real")?.live.power_w, 2, " W")).toBe("—");
        expect(stream({ ...summary, simulation: undefined }, "simulation")).toBeUndefined();
    });

    it("keeps server-provided dimensional fields unchanged and labels them explicitly", async () => {
        const summary = await readData<Summary>("/api/dashboard/summary", { coop_id: 41 });
        expect(summary.cycle_totals).toMatchObject({ water_liters: 1500, energy_kwh: 2, energy_wh_per_bird: 20, population_basis: 100 });
        expect(metric(summary.cycle_totals?.water_liters, 0, " L")).toBe("1.500 L");
        expect(metric(summary.cycle_totals?.energy_wh_per_bird, 0, " Wh/ekor")).toBe("20 Wh/ekor");
        expect(metric(summary.active_cycle?.day_age, 0)).toBe("1");
    });

    it("does not display missing or invalid metrics as zero", () => {
        for (const value of [null, undefined, "", NaN, Infinity, "invalid"]) expect(metric(value)).toBe("—");
        expect(metric(0)).toBe("0");
    });

    it("converts display dimensions once while retaining missing and accepted-zero", () => {
        expect(wattsToKw(500)).toBe(0.5);
        expect(litersToM3(1500)).toBe(1.5);
        expect(kwhToWh(2)).toBe(2000);
        for (const convert of [wattsToKw, litersToM3, kwhToWh]) {
            expect(convert(null)).toBeNull();
            expect(convert(undefined)).toBeNull();
            expect(convert(0)).toBe(0);
        }
    });

    it("isolates query scopes by account, farm, coop, source and cycle", () => {
        const initial = queryScope(1, 2, 3, "real", 4);
        expect(initial).not.toEqual(queryScope(2, 2, 3, "real", 4));
        expect(initial).not.toEqual(queryScope(1, 5, 3, "real", 4));
        expect(initial).not.toEqual(queryScope(1, 2, 5, "real", 4));
        expect(initial).not.toEqual(queryScope(1, 2, 3, "simulation", 4));
        expect(initial).not.toEqual(queryScope(1, 2, 3, "real", 5));
        expect(initial).toEqual(["broiler", 1, 2, 3, "real", 4]);
    });
});
