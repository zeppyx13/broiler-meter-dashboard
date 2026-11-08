import { test, expect, type Page } from "@playwright/test";

// Every request is intercepted: these scenarios never reach the production API.
const baseline = {
    pricePerKg: 19_500,
    harvestWeightKg: 1.73,
    preventedMortalityPct: 1,
    deviceCost: 1_080_000,
    cycleDays: 60,
    electricitySavingPerCycle: 0,
    waterSavingPerCycle: 0,
    opexMonthly: 195_000,
    maintenancePerYear: 100_000,
};
const coop = { id: 101, farm_id: 10, code: "ROI-01", name: "Kandang ROI", status: "active", capacity_birds: 500 };
const farm = { id: 10, name: "Lahan ROI", timezone: "Asia/Makassar", electricity_rate_idr_per_kwh: 1500, water_rate_idr_per_m3: 10_000, capabilities: {}, effective_role: "owner" };
const cycle = { id: 201, coop_id: coop.id, cycle_code: "ROI-TEST", status: "active", initial_population: 500, current_population: 500, day_age: 15, placement_date: "2026-10-25" };
const user = { id: 1, name: "Peternak ROI", email: "roi@example.test", role: "owner", default_coop_id: coop.id };

async function isolatedDashboard(page: Page, baseURL: string) {
    const writes: string[] = [];
    const unexpected: string[] = [];
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.context().addCookies([{ name: "coasther_token", value: "roi-isolated-browser-test", url: baseURL }]);
    await page.addInitScript(settings => {
        if (localStorage.getItem("coasther_impact_settings") == null) {
            localStorage.setItem("coasther_impact_settings", JSON.stringify(settings));
        }
    }, baseline);
    await page.routeWebSocket(/\/socket\.io\//, socket => {
        socket.send('0{"sid":"roi-fixture","upgrades":[],"pingInterval":60000,"pingTimeout":60000,"maxPayload":1000000}');
        socket.onMessage(message => {
            const text = String(message);
            if (text.startsWith("40")) socket.send('40{"sid":"roi-fixture"}');
            const subscribe = /^42(\d+)\["coop:subscribe"/.exec(text);
            if (subscribe) socket.send(`43${subscribe[1]}[{"success":true}]`);
        });
    });
    await page.route(/\/socket\.io\//, route => route.abort());
    await page.route(/\/api\//, async route => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
        if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
        if (request.method() !== "GET") {
            writes.push(`${request.method()} ${path}`);
            return route.fulfill({ status: 405, headers, json: { success: false, message: "Simulation must be read-only" } });
        }
        let data: unknown;
        if (path === "/api/auth/me") data = { user };
        else if (path === "/api/farms") data = { farms: [farm] };
        else if (path === "/api/coops") data = { coops: [coop] };
        else if (path === "/api/devices") data = { devices: [] };
        else if (path === "/api/dashboard/context") data = { state: "active", coop, active_cycle: cycle };
        else if (path === `/api/coops/${coop.id}/capabilities`) data = { effective_role: "owner", capabilities: {} };
        else if (path === "/api/dashboard/summary") data = { state: "active", coop, farm, active_cycle: cycle, live: null, today: null, cycle_totals: null, devices: [], generated_at: "2026-11-08T00:00:00Z" };
        else if (path === "/api/alerts") data = { alerts: [] };
        else if (path === "/api/guard/status") data = { evaluations: [] };
        else if (path === `/api/flock-cycles/${cycle.id}/profile`) data = { profile: null };
        else if (path === `/api/coops/${coop.id}/reports/monthly`) data = { series: [] };
        else {
            unexpected.push(path);
            return route.fulfill({ status: 501, headers, json: { success: false, message: "Unexpected fixture endpoint" } });
        }
        await route.fulfill({ status: 200, headers, json: { success: true, data } });
    });
    return { writes, unexpected, errors };
}

function metricCard(page: Page, label: string) {
    return page.getByRole("region", { name: "Hasil perhitungan balik modal" }).getByText(label, { exact: true }).locator("..");
}

async function expectReportSimulationLink(page: Page) {
    const link = page.getByRole("link", { name: "Simulasi Balik Modal", exact: true });
    await expect(link).toHaveCount(1);
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/dashboard/tagihan/simulasi");
    await expect(page.getByRole("region", { name: "Hasil perhitungan balik modal" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Balik modal", exact: true })).toHaveCount(0);
    for (const label of ["Manfaat / tahun", "Biaya investasi", "ROI tahun pertama", "Rincian per kandang"]) {
        await expect(page.getByText(label, { exact: true })).toHaveCount(0);
    }
    await expect(page.getByText(/Kejadian Guard|Titik impas/)).toHaveCount(0);
}

async function fillScenario(page: Page) {
    const values: Record<string, string> = {
        "Jumlah kandang": "2",
        "Populasi per kandang": "1000",
        "Biaya perangkat": "1000000",
        "Siklus + istirahat": "50",
        "Harga ayam hidup": "20000",
        "Kematian dicegah": "1",
        "Bobot panen": "2",
        "Langganan internet, server, AI": "100000",
        "Perawatan perangkat": "10000",
        "Tarif listrik": "2000",
        "Tarif air": "5000",
        "Estimasi hemat listrik": "10",
        "Estimasi hemat air": "2",
    };
    for (const [label, value] of Object.entries(values)) await page.getByLabel(label, { exact: true }).fill(value);
}

test("ROI navigation, dynamic utility tariffs, reset and report isolation", async ({ page, baseURL }) => {
    const evidence = await isolatedDashboard(page, baseURL!);
    await page.goto("/dashboard/tagihan");
    await expect(page.getByRole("heading", { name: "Cetak laporan kandang" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Efisiensi bulanan" })).toBeVisible();
    await expect(page.getByText("Ubah asumsi", { exact: true })).toHaveCount(0);
    await expectReportSimulationLink(page);
    await page.getByRole("link", { name: "Simulasi Balik Modal", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/tagihan\/simulasi$/);
    await expect(page.getByRole("heading", { name: "Simulasi Balik Modal", level: 1 })).toBeVisible();
    await fillScenario(page);
    await expect(metricCard(page, "Manfaat / tahun")).toContainText("6.278.000");
    await expect(metricCard(page, "Biaya investasi")).toContainText("2.000.000");
    await expect(metricCard(page, "Biaya tahun pertama")).toContainText("3.220.000");
    await expect(metricCard(page, "ROI tahun pertama")).toContainText("+95%");
    await expect(metricCard(page, "Balik modal")).toContainText("4,7 bulan");
    await expect(page.getByRole("region", { name: "Hasil perhitungan balik modal" })).toContainText(/Titik impas.*301/);

    await page.getByLabel("Tarif air", { exact: true }).fill("10000");
    await expect(metricCard(page, "Manfaat / tahun")).toContainText("6.424.000");
    await page.getByLabel("Tarif listrik", { exact: true }).fill("3000");
    await expect(metricCard(page, "Manfaat / tahun")).toContainText("6.570.000");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("coasther_impact_settings"))).toBe(JSON.stringify(baseline));

    await page.getByRole("button", { name: "Reset asumsi", exact: true }).click();
    await expect(page.getByLabel("Jumlah kandang", { exact: true })).toHaveValue("1");
    await expect(page.getByLabel("Populasi per kandang", { exact: true })).toHaveValue("500");
    await expect(page.getByLabel("Tarif listrik", { exact: true })).toHaveValue("1500");
    await page.getByLabel("Populasi per kandang", { exact: true }).fill("8000");
    await page.reload();
    await expect(page.getByLabel("Populasi per kandang", { exact: true })).toHaveValue("500");
    await page.getByRole("link", { name: "Kembali ke Laporan", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/tagihan$/);
    await expectReportSimulationLink(page);
    await expect(page.getByRole("heading", { name: "Cetak laporan kandang" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Efisiensi bulanan" })).toBeVisible();
    expect(evidence.writes).toEqual([]);
    expect(evidence.unexpected).toEqual([]);
    expect(evidence.errors).toEqual([]);
});

test("ROI rejects invalid assumptions and handles zero benefits without infinities", async ({ page, baseURL }) => {
    const evidence = await isolatedDashboard(page, baseURL!);
    await page.goto("/dashboard/tagihan/simulasi");
    const count = page.getByLabel("Jumlah kandang", { exact: true });
    await expect(count).toHaveValue("1");
    for (const value of ["", "-1", "1.5"]) {
        await count.fill(value);
        await expect(count).toHaveAttribute("aria-invalid", "true");
        await expect(page.getByRole("alert").first()).toBeVisible();
        await expect(page.getByRole("region", { name: "Hasil perhitungan balik modal" })).toHaveCount(0);
    }
    await count.fill("1");
    const days = page.getByLabel("Siklus + istirahat", { exact: true });
    await days.fill("0");
    await expect(days).toHaveAttribute("aria-invalid", "true");
    await days.fill("60");
    const mortality = page.getByLabel("Kematian dicegah", { exact: true });
    await mortality.fill("101");
    await expect(mortality).toHaveAttribute("aria-invalid", "true");
    await mortality.fill("0");
    await page.getByLabel("Estimasi hemat listrik", { exact: true }).fill("0");
    await page.getByLabel("Estimasi hemat air", { exact: true }).fill("0");
    await expect(metricCard(page, "Manfaat / tahun")).toContainText(/Rp\s*0/);
    await expect(metricCard(page, "Balik modal")).toContainText("Tidak tercapai");
    await expect(page.getByRole("region", { name: "Hasil perhitungan balik modal" })).not.toContainText(/NaN|Infinity/);
    expect(evidence.writes).toEqual([]);
    expect(evidence.errors).toEqual([]);
});

for (const width of [360, 768, 1440]) {
    test(`ROI responsive ${width}px`, async ({ page, baseURL }, testInfo) => {
        const evidence = await isolatedDashboard(page, baseURL!);
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/dashboard/tagihan");
        await expectReportSimulationLink(page);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await page.getByRole("link", { name: "Simulasi Balik Modal", exact: true }).click();
        await expect(page).toHaveURL(/\/dashboard\/tagihan\/simulasi$/);
        await expect(page.getByLabel("Jumlah kandang", { exact: true })).toHaveValue("1");
        await expect(page.getByRole("link", { name: "Kembali ke Laporan", exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`roi-${width}.png`), fullPage: true });
        expect(evidence.errors).toEqual([]);
        expect(evidence.writes).toEqual([]);
    });
}
