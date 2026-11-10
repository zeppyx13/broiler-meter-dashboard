import { test, expect, type Page, type Route } from "@playwright/test";

// Isolated browser fixtures: all API and socket requests stay inside the test.
const user = { id: 901, name: "Pengguna Uji", email: "register@example.invalid", role: "operator", phone: "081234567890", is_verified: 1, default_coop_id: null };
const password = "  Fixture password!  ";
const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
type Submission = { path: string; method: string; body: Record<string, unknown>; contentType: string };

async function isolatedApi(page: Page, onRegister?: (route: Route) => Promise<void> | void) {
    const submissions: Submission[] = [];
    const unexpected: string[] = [];
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.routeWebSocket(/\/socket\.io\//, socket => socket.close());
    await page.route(/\/socket\.io\//, route => route.abort());
    await page.route(/\/api\//, async route => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
        if (path === "/api/auth/register" || path === "/api/auth/login") {
            submissions.push({ path, method: request.method(), body: request.postDataJSON(), contentType: request.headers()["content-type"] ?? "" });
            if (path === "/api/auth/register" && onRegister) return onRegister(route);
            return route.fulfill({ status: path.endsWith("register") ? 201 : 200, headers, json: { success: true, data: { user, token: "fixture-returned-token" } } });
        }
        unexpected.push(`${request.method()} ${path}`);
        await route.fulfill({ status: 501, headers, json: { success: false, message: "Unexpected fixture endpoint" } });
    });
    return { submissions, unexpected, errors };
}

async function fillRegistration(page: Page, values: Partial<Record<"name" | "email" | "phone" | "password" | "confirm-password", string>> = {}) {
    const fields = { name: "  Pengguna Uji  ", email: "  REGISTER@EXAMPLE.INVALID  ", phone: "  081234567890  ", password, "confirm-password": password, ...values };
    for (const [field, value] of Object.entries(fields)) await page.locator(`#register-${field}`).fill(value);
}

async function expectInlineError(page: Page, field: string) {
    const input = page.locator(`#register-${field}`);
    await expect(input).toHaveAttribute("aria-invalid", "true");
    const description = await input.getAttribute("aria-describedby");
    expect(description).toBeTruthy();
    const errorId = description!.split(" ").find(id => id.endsWith("-error"));
    expect(errorId).toBeTruthy();
    await expect(page.locator(`[id="${errorId}"]`)).not.toBeEmpty();
}

test("public Login/Register links and normalized registration without an automatic session", async ({ page, context }) => {
    const evidence = await isolatedApi(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Masuk ke Dashboard" })).toBeVisible();
    await page.getByRole("link", { name: "Daftar", exact: true }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole("heading", { name: "Daftar Akun" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Masuk", exact: true })).toHaveAttribute("href", "/");
    await fillRegistration(page);
    await page.getByRole("button", { name: "Daftar", exact: true }).click();
    await expect(page.getByText("Pendaftaran berhasil", { exact: true })).toBeVisible();
    expect(evidence.submissions).toHaveLength(1);
    expect(evidence.submissions[0]).toEqual({
        path: "/api/auth/register", method: "POST", contentType: "application/json",
        body: { name: "Pengguna Uji", email: "register@example.invalid", phone: "081234567890", password },
    });
    expect((await context.cookies()).some(cookie => ["coasther_token", "coasther_user"].includes(cookie.name))).toBe(false);
    expect(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))).not.toContain(password);
    expect(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))).not.toContain("fixture-returned-token");
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Masuk ke Dashboard" })).toBeVisible();
    expect(evidence.unexpected).toEqual([]);
    expect(evidence.errors).toEqual([]);
});

test("empty, malformed, oversized and mismatched fields stay inline without an API request", async ({ page }) => {
    const evidence = await isolatedApi(page);
    await page.goto("/register");
    await page.getByRole("button", { name: "Daftar", exact: true }).click();
    for (const field of ["name", "email", "password", "confirm-password"]) await expectInlineError(page, field);
    await expect(page.locator("#register-name")).toBeFocused();
    await fillRegistration(page, { name: "A", email: "invalid-email", password: "12345", "confirm-password": "different" });
    await page.getByRole("button", { name: "Daftar", exact: true }).click();
    for (const field of ["name", "email", "password", "confirm-password"]) await expectInlineError(page, field);
    await fillRegistration(page, { "confirm-password": "mismatched-password" });
    await page.getByRole("button", { name: "Daftar", exact: true }).click();
    await expectInlineError(page, "confirm-password");
    await fillRegistration(page, { password: "      ", "confirm-password": "      " });
    await page.getByRole("button", { name: "Daftar", exact: true }).click();
    await expectInlineError(page, "password");
    await fillRegistration(page, {
        name: "A".repeat(121),
        email: `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.invalid`,
        phone: "0".repeat(31),
    });
    await page.getByRole("button", { name: "Daftar", exact: true }).click();
    for (const field of ["name", "email", "phone"]) await expectInlineError(page, field);
    expect(evidence.submissions).toEqual([]);
});

test("password validation measures UTF-8 bytes and phone remains optional", async ({ page }) => {
    const evidence = await isolatedApi(page);
    await page.goto("/register");
    await fillRegistration(page, { phone: "", password: "🔐".repeat(19), "confirm-password": "🔐".repeat(19) });
    await page.getByRole("button", { name: "Daftar", exact: true }).click();
    await expectInlineError(page, "password");
    expect(evidence.submissions).toEqual([]);
    await fillRegistration(page, { phone: "" });
    await page.getByRole("button", { name: "Daftar", exact: true }).click();
    await expect(page.getByText("Pendaftaran berhasil", { exact: true })).toBeVisible();
    expect(evidence.submissions).toHaveLength(1);
    expect(evidence.submissions[0].body.phone ?? "").toBe("");
    expect(Object.keys(evidence.submissions[0].body).filter(key => !["name", "email", "phone", "password"].includes(key))).toEqual([]);
});

for (const status of [400, 409, 500]) {
    test(`HTTP ${status} stays on Register with a safe error`, async ({ page }) => {
        const evidence = await isolatedApi(page, route => route.fulfill({ status, headers, json: { success: false, message: "Email already registered; internal_secret SQL stack trace", stack: "internal_secret" } }));
        await page.goto("/register");
        await fillRegistration(page);
        await page.getByRole("button", { name: "Daftar", exact: true }).click();
        const alert = page.locator("form").getByRole("alert");
        await expect(alert).toContainText(status === 409 ? "Email sudah terdaftar" : status === 400 ? "Data pendaftaran tidak valid" : "Server sedang bermasalah");
        await expect(alert).not.toContainText("internal_secret");
        await expect(page).toHaveURL(/\/register$/);
        await expect(page.getByRole("button", { name: "Daftar", exact: true })).toBeEnabled();
        expect(evidence.submissions).toHaveLength(1);
    });
}

test("network failure gives a safe message without automatic retries", async ({ page }) => {
    const evidence = await isolatedApi(page, route => route.abort("failed"));
    await page.goto("/register");
    await fillRegistration(page);
    await page.getByRole("button", { name: "Daftar", exact: true }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText("Tidak dapat terhubung ke server");
    await expect(page.getByRole("button", { name: "Daftar", exact: true })).toBeEnabled();
    expect(evidence.submissions).toHaveLength(1);
});

test("request timeout leaves the uncertain result visible without a retry", async ({ page }) => {
    let pendingRoute: Route | undefined;
    const evidence = await isolatedApi(page, route => { pendingRoute = route; });
    await page.goto("/register");
    await fillRegistration(page);
    await page.getByRole("button", { name: "Daftar", exact: true }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText("Waktu tunggu habis", { timeout: 25000 });
    await expect(page.locator("form").getByRole("alert")).toContainText("Coba masuk sebelum mendaftar lagi");
    await expect(page.getByRole("button", { name: "Daftar", exact: true })).toBeEnabled();
    expect(evidence.submissions).toHaveLength(1);
    await pendingRoute?.abort().catch(() => {});
});

test("simultaneous submit events produce one pending request", async ({ page }) => {
    let pendingRoute: Route | undefined;
    const evidence = await isolatedApi(page, route => { pendingRoute = route; });
    await page.goto("/register");
    await fillRegistration(page);
    await page.locator("form").evaluate(form => {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await expect.poll(() => evidence.submissions.length).toBe(1);
    await expect(page.getByRole("button", { name: "Mendaftarkan...", exact: true })).toBeDisabled();
    await pendingRoute!.fulfill({ status: 201, headers, json: { success: true, data: { user } } });
    await expect(page.getByText("Pendaftaran berhasil", { exact: true })).toBeVisible();
    expect(evidence.submissions).toHaveLength(1);
});

for (const viewport of [{ width: 360, height: 800 }, { width: 1440, height: 600 }]) {
    test(`registration keyboard and responsive layout at ${viewport.width}x${viewport.height}px`, async ({ page }) => {
        const evidence = await isolatedApi(page);
        await page.setViewportSize(viewport);
        await page.goto("/register");
        const heading = page.getByRole("heading", { name: "Daftar Akun" });
        await expect(heading).toBeVisible();
        expect((await heading.boundingBox())!.y).toBeGreaterThanOrEqual(0);
        await page.locator("#register-name").focus();
        for (const field of ["email", "phone", "password"]) {
            await page.keyboard.press("Tab");
            await expect(page.locator(`#register-${field}`)).toBeFocused();
        }
        await expect(page.locator("#register-password")).toHaveAttribute("autocomplete", "new-password");
        await page.locator("#register-password").fill(password);
        await page.getByRole("button", { name: "Tampilkan password", exact: true }).click();
        await expect(page.locator("#register-password")).toHaveAttribute("type", "text");
        await page.getByRole("button", { name: "Sembunyikan password", exact: true }).click();
        await expect(page.locator("#register-password")).toHaveAttribute("type", "password");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        const submit = page.getByRole("button", { name: "Daftar", exact: true });
        await submit.scrollIntoViewIfNeeded();
        await expect(submit).toBeInViewport();
        const submitBounds = (await submit.boundingBox())!;
        expect(submitBounds.y).toBeGreaterThanOrEqual(0);
        expect(submitBounds.y + submitBounds.height).toBeLessThanOrEqual(viewport.height + 1);
        await page.getByRole("link", { name: "Masuk", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Masuk ke Dashboard" })).toBeVisible();
        expect(evidence.submissions).toEqual([]);
        expect(evidence.errors).toEqual([]);
    });
}

test("proxy redirects authenticated auth pages and protects Dashboard", async ({ context, baseURL }) => {
    const anonymous = await context.request.get(`${baseURL}/dashboard`, { maxRedirects: 0 });
    expect(anonymous.status()).toBe(307);
    expect(new URL(anonymous.headers().location, baseURL).pathname).toBe("/");
    await context.addCookies([{ name: "coasther_token", value: "fixture-existing-session", url: baseURL! }]);
    for (const path of ["/", "/register"]) {
        const response = await context.request.get(`${baseURL}${path}`, { maxRedirects: 0 });
        expect(response.status()).toBe(307);
        expect(new URL(response.headers().location, baseURL).pathname).toBe("/dashboard");
    }
});

test("existing Login still sends its original contract and establishes a session", async ({ page, context }) => {
    const evidence = await isolatedApi(page);
    // Returning HTML to the router fetch makes Next use a document navigation.
    // Both requests land on this local placeholder rather than the real Dashboard.
    await page.route(/\/dashboard(?:\?.*)?$/, route => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><html lang=\"id\"><body><main>Dashboard fixture</main></body></html>" }));
    await page.goto("/");
    await page.locator("#email").fill(user.email);
    await page.locator("#password").fill(password);
    await page.getByLabel("Ingat saya").check();
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page.getByText("Login berhasil", { exact: true })).toBeVisible();
    expect(evidence.submissions).toHaveLength(1);
    expect(evidence.submissions[0]).toMatchObject({ path: "/api/auth/login", method: "POST", body: { email: user.email, password } });
    expect(Object.keys(evidence.submissions[0].body).sort()).toEqual(["email", "password"]);
    expect((await context.cookies()).find(cookie => cookie.name === "coasther_token")?.value).toBe("fixture-returned-token");
    await page.getByRole("button", { name: "OK", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Dashboard fixture", { exact: true })).toBeVisible();
    expect(evidence.unexpected).toEqual([]);
    expect(evidence.errors).toEqual([]);
});
