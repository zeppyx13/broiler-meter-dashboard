import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { AxiosError } from "axios";
import { api } from "./api";
import { register } from "./auth-api";
import { registerErrorMessage } from "./api-error";

const auth = vi.hoisted(() => ({ set: vi.fn(), clear: vi.fn() }));
vi.mock("./auth", () => ({ getToken: () => undefined, setAuth: auth.set, clearAuth: auth.clear }));

type Received = { method?: string; path?: string; contentType?: string; authorization?: string; body: unknown };
const received: Received[] = [];
const user = { id: 301, name: "Fixture Operator", email: "fixture@example.invalid", role: "operator", default_coop_id: null, scope: { farm_ids: [], coop_ids: [] } };
const success = { success: true, message: "Register success", data: { user, token: "synthetic-registration-token" } };
const payload = { name: "Fixture Operator", email: "fixture@example.invalid", password: "fixture-only-password" };
const privateDetails = "PRIVATE_FIXTURE_DETAIL: password=fixture-secret; stack at internal/auth.js";
let reply: { status: number; body: unknown; contentType?: string };
let server: Server;
let originalBase: string | undefined;
let originalProxy: typeof api.defaults.proxy;

beforeAll(async () => {
    originalBase = api.defaults.baseURL;
    originalProxy = api.defaults.proxy;
    server = createServer(async (request, response) => {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        received.push({
            method: request.method,
            path: request.url,
            contentType: request.headers["content-type"],
            authorization: request.headers.authorization,
            body: JSON.parse(Buffer.concat(chunks).toString()),
        });
        response.statusCode = reply.status;
        response.setHeader("content-type", reply.contentType ?? "application/json");
        response.end(reply.contentType === "text/html" ? String(reply.body) : JSON.stringify(reply.body));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    api.defaults.baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    api.defaults.proxy = false;
});

beforeEach(() => {
    received.length = 0;
    reply = { status: 201, body: success };
    vi.clearAllMocks();
});

afterAll(async () => {
    api.defaults.baseURL = originalBase;
    api.defaults.proxy = originalProxy;
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

describe("public registration through isolated HTTP", () => {
    it("uses the configured server, JSON and only public fields while preserving the password", async () => {
        const password = "  sandi-é🐔-fixture  ";
        await expect(register({
            ...payload,
            name: "  Fixture Operator  ",
            email: "  Fixture@EXAMPLE.invalid  ",
            password,
            phone: "  +62 812-3456  ",
            role: "admin",
            is_verified: 1,
            farm_id: 10,
            coop_id: 20,
            default_coop_id: 20,
            confirmPassword: password,
        } as Parameters<typeof register>[0])).resolves.toBeUndefined();
        expect(received).toEqual([{
            method: "POST",
            path: "/api/auth/register",
            contentType: "application/json",
            authorization: undefined,
            body: { name: "Fixture Operator", email: "fixture@example.invalid", password, phone: "+62 812-3456" },
        }]);
        expect(auth.set).not.toHaveBeenCalled();
        expect(auth.clear).not.toHaveBeenCalled();
    });

    it.each([undefined, "", "   "])("omits an optional blank phone (%s)", async (phone) => {
        await register({ ...payload, phone });
        expect(received[0].body).toEqual(payload);
    });

    it.each([
        { label: "missing envelope", status: 201, body: {} },
        { label: "missing user", status: 201, body: { success: true, data: {} } },
        { label: "missing user id", status: 201, body: { success: true, data: { user: { name: "Fixture" } } } },
        { label: "null user id", status: 201, body: { success: true, data: { user: { id: null } } } },
        { label: "HTTP 200", status: 200, body: success },
        { label: "explicit failure", status: 201, body: { ...success, success: false } },
        { label: "null response", status: 201, body: null },
        { label: "HTML response", status: 201, body: `<html>${privateDetails}</html>`, contentType: "text/html" },
    ])("rejects $label without starting a session or retrying", async (fixture) => {
        reply = fixture;
        await expect(register(payload)).rejects.toThrow(/belum dapat dikonfirmasi/);
        expect(received).toHaveLength(1);
        expect(auth.set).not.toHaveBeenCalled();
    });

    it("propagates a duplicate response once so registration cannot retry the write", async () => {
        reply = { status: 409, body: { success: false, message: "Email already registered" } };
        await expect(register(payload)).rejects.toMatchObject({ response: { status: 409 } });
        expect(received).toHaveLength(1);
        expect(auth.set).not.toHaveBeenCalled();
    });
});

describe("safe registration failure messages", () => {
    it.each([
        [400, /tidak valid/],
        [422, /tidak valid/],
        [409, /Email sudah terdaftar/],
        [429, /Terlalu banyak percobaan/],
        [500, /Server sedang bermasalah/],
        [503, /Server sedang bermasalah/],
        [403, /belum dapat dikonfirmasi/],
    ] as const)("handles HTTP %i without exposing backend details", async (status, expected) => {
        reply = { status, body: { success: false, message: privateDetails, errors: [{ path: "password", message: privateDetails }] } };
        const error = await register(payload).catch((failure: unknown) => failure);
        const message = registerErrorMessage(error);
        expect(message).toMatch(expected);
        expect(message).not.toMatch(/PRIVATE_FIXTURE_DETAIL|fixture-secret|internal\/auth\.js/);
        expect(received).toHaveLength(1);
    });

    it.each(["ECONNABORTED", "ETIMEDOUT"])("explains ambiguous %s timeout without leaking transport details", (code) => {
        const message = registerErrorMessage(new AxiosError(privateDetails, code));
        expect(message).toMatch(/Waktu tunggu habis/);
        expect(message).toMatch(/Coba masuk sebelum mendaftar lagi/);
        expect(message).not.toContain(privateDetails);
    });

    it("explains a network failure without exposing request data", () => {
        const message = registerErrorMessage(new AxiosError(privateDetails, "ERR_NETWORK"));
        expect(message).toMatch(/Tidak dapat terhubung ke server/);
        expect(message).not.toContain(privateDetails);
    });

    it.each([new Error(privateDetails), privateDetails, null, undefined, { message: privateDetails }])("uses safe wording for an unknown error", (error) => {
        const message = registerErrorMessage(error);
        expect(message).toMatch(/belum dapat dikonfirmasi/);
        expect(message).not.toContain(privateDetails);
    });
});
