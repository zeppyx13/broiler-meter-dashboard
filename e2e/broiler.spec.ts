import { test, expect, type Page } from "@playwright/test";
type Fixture = { users: Record<string, { email: string }>; coops: { id: number; farm_id: number }[]; farm: { id: number }; second: { id: number }; today: string };
let fixture: Fixture;
test.beforeAll(async ({ request }) => { fixture = await (await request.get("http://127.0.0.1:4301/__fixture")).json(); });
async function login(page: Page, role: string) {
    await page.goto("/"); await page.getByLabel("Email", { exact: true }).fill(fixture.users[role].email);
    await page.locator("#password").fill("Phase5-browser-fixture!");
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page.getByText("Login berhasil", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "OK", exact: true }).click();
    await expect(page.getByLabel("Pilih kandang")).toContainText("B1");
    await page.getByLabel("Pilih kandang").selectOption(String(fixture.coops[0].id));
}
test("owner: real login, source/farm switching, persisted daily correction, dialogs, pages and Copilot unavailable", async ({ page }) => {
    const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    const failures: string[] = []; page.on("response", r => { if (r.url().startsWith("http://127.0.0.1:4301/api/") && r.status() >= 400) failures.push(`${r.request().method()} ${new URL(r.url()).pathname} ${r.status()}`); });
    await login(page, "owner");
    await expect(page.getByRole("heading", { name: "Status seluruh kandang yang dapat diakses" })).toBeVisible();
    await page.getByLabel("Pilih sumber data").selectOption("simulation");
    await expect(page.getByText("SIMULASI BACKEND", { exact: true })).toBeVisible();
    await page.getByLabel("Pilih lahan").selectOption(String(fixture.second.id));
    await expect(page.getByLabel("Pilih kandang")).toHaveValue(String(fixture.coops[2].id));
    await page.getByLabel("Pilih lahan").selectOption(String(fixture.farm.id));
    await page.goto(`/dashboard/kamar/${fixture.coops[0].id}`);
    await page.getByLabel("Pilih kandang").selectOption(String(fixture.coops[1].id));
    await expect(page).toHaveURL(`http://127.0.0.1:4300/dashboard/kamar/${fixture.coops[1].id}`);
    await expect(page.getByLabel("Pilih kandang")).toHaveValue(String(fixture.coops[1].id));
    await page.getByLabel("Pilih kandang").selectOption(String(fixture.coops[0].id));
    await expect(page).toHaveURL(`http://127.0.0.1:4300/dashboard/kamar/${fixture.coops[0].id}`);
    await page.getByRole("tab", { name: "Catat Harian" }).click();
    await expect(page.getByRole("button", { name: "Koreksi", exact: true }).or(page.getByText("Belum ada catatan. Catatan nol mortalitas dapat tetap menyimpan pakan dan bobot.", { exact: true }))).toBeVisible();
    if (await page.getByRole("button", { name: "Koreksi", exact: true }).count()) await page.getByRole("button", { name: "Koreksi", exact: true }).click();
    else await page.getByRole("button", { name: "Catat Harian", exact: true }).click();
    const dialog = page.getByRole("dialog"); await expect(dialog).toBeVisible();
    await dialog.getByLabel("Mati (ekor)", { exact: true }).fill("2");
    await dialog.getByLabel("Afkir (ekor)", { exact: true }).fill("1");
    await dialog.getByLabel("Pakan hari ini (kg)", { exact: true }).fill("10");
    await dialog.getByLabel("Bobot sampel rata-rata (g)", { exact: true }).fill("900");
    await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
    await expect(dialog).not.toBeVisible(); await expect(page.getByText(/Mati 2.*afkir 1/)).toBeVisible();
    await page.reload(); await page.getByRole("tab", { name: "Catat Harian" }).click();
    await expect(page.getByText(/Mati 2.*afkir 1/)).toBeVisible();
    await page.getByRole("button", { name: "Koreksi", exact: true }).click();
    await page.getByRole("dialog").getByLabel("Mati (ekor)", { exact: true }).fill("1");
    await page.getByRole("dialog").getByRole("button", { name: "Simpan", exact: true }).click();
    await expect(page.getByText(/Mati 1.*afkir 1/)).toBeVisible();
    await page.getByRole("button", { name: "Catat Harian", exact: true }).click(); await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible();
    for (const route of ["iot", "peringatan", "tagihan", "settings", "terminal"]) {
        await page.goto(`/dashboard/${route}`); await expect(page.getByLabel("Pilih kandang")).toBeVisible();
        await expect(page.locator("main")).not.toContainText("Application error");
    }
    await page.getByLabel("Buka Copilot").click(); await page.getByLabel("Pesan Copilot").fill("Apa kualitas data kandang ini?");
    await page.getByRole("button", { name: "Kirim", exact: true }).click();
    await expect(page.getByText(/Copilot belum tersedia/)).toBeVisible();
    expect(errors).toEqual([]);
    expect(failures).toEqual([]);
});
test("owner: start cycle and atomic harvest through the isolated UI", async ({ page }) => {
    await login(page, "owner"); await page.goto(`/dashboard/kamar/${fixture.coops[1].id}`);
    await page.getByRole("tab", { name: "Catat Harian" }).click();
    await page.getByRole("button", { name: "Mulai siklus", exact: true }).click();
    await page.getByRole("dialog").getByLabel("Kode siklus unik", { exact: true }).fill(`Browser cycle ${Date.now()}`);
    await page.getByRole("dialog").getByLabel("Populasi awal", { exact: true }).fill("100");
    await page.getByRole("dialog").getByRole("button", { name: "Simpan", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.getByRole("button", { name: "Panen & tutup", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Simpan", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Mulai siklus", exact: true })).toBeVisible();
});
test("expired JWT clears the session without a redirect loop", async ({ page, context }) => {
    await context.addCookies([{ name: "coasther_token", value: "expired.invalid.token", domain: "127.0.0.1", path: "/" }]);
    await page.goto("/dashboard"); await expect(page.locator("#password")).toBeVisible();
    await expect(page).toHaveURL("http://127.0.0.1:4300/");
    expect((await context.cookies()).some(c => c.name === "coasther_token")).toBe(false);
});
for (const role of ["manager", "operator", "viewer"]) test(`${role}: canonical role and scoped coops`, async ({ page }) => {
    await login(page, role);
    await expect(page.getByLabel("Pilih kandang").locator("option")).toHaveCount(role === "operator" ? 1 : 2);
    await page.goto(`/dashboard/kamar/${fixture.coops[0].id}`); await page.getByRole("tab", { name: "Catat Harian" }).click();
    if (role === "viewer") await expect(page.getByRole("button", { name: "Catat Harian", exact: true })).toHaveCount(0);
    else await expect(page.getByRole("button", { name: "Catat Harian", exact: true })).toBeVisible();
    if (role === "operator") { await page.goto(`/dashboard/kamar/${fixture.coops[1].id}`); await expect(page.getByText("Kandang tidak tersedia atau akses tidak diizinkan.")).toBeVisible(); }
});
for (const width of [360, 390, 768, 1440]) test(`responsive ${width}px and no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await login(page, "owner");
    await page.goto(`/dashboard/kamar/${fixture.coops[0].id}`); await page.getByRole("tab", { name: "Peralatan" }).click();
    await expect(page.getByRole("heading", { name: "Peralatan deklaratif" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `docs/audit/result/browser-${width}.png`, fullPage: true });
});
test("owner: equipment declaration, cycle profile and calibration persist via production forms", async ({ page }) => {
    await login(page, "owner"); await page.goto(`/dashboard/kamar/${fixture.coops[0].id}`);
    await page.getByRole("tab", { name: "Peralatan" }).click();
    await page.getByRole("button", { name: "Tambah peralatan" }).click();
    const form = page.getByRole("dialog");
    const name = `Fixture fan ${Date.now()}`;
    await form.getByLabel("Nama peralatan", { exact: true }).fill(name);
    await form.getByLabel("Watt tertera per unit", { exact: true }).fill("45");
    await form.getByRole("button", { name: "Simpan", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible(); await expect(page.getByText(`${name} · fan`, { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Pengaturan", exact: true }).click();
    await page.getByLabel("Strain (deklarasi, bukan kurva biologis)", { exact: true }).fill("Fixture strain");
    await page.getByLabel("Target panen hari ke-N (Day 1 chick-in)", { exact: true }).fill("35");
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    await expect(page.getByLabel("Target panen hari ke-N (Day 1 chick-in)", { exact: true })).toHaveValue("35");
    await page.reload(); await page.getByRole("tab", { name: "Pengaturan", exact: true }).click();
    await expect(page.getByLabel("Strain (deklarasi, bukan kurva biologis)", { exact: true })).toHaveValue("Fixture strain");
    await page.goto("/dashboard/tagihan");
    await page.getByLabel("Nilai instrumen acuan", { exact: true }).fill("10");
    await page.getByLabel("Nilai sensor", { exact: true }).fill("9.8");
    await page.getByLabel("Identitas instrumen acuan", { exact: true }).fill(name);
    await page.getByLabel("Metode dan kondisi uji (min. 8 karakter)", { exact: true }).fill("Isolated browser fixture only, no physical measurement");
    await page.getByRole("form", { name: "Catat pengukuran manual" }).getByRole("button", { name: "Simpan", exact: true }).click();
    await expect(page.getByText(`water · ${name} · manual_recorded`, { exact: true })).toBeVisible();
});
