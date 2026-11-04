// Jawaban Copilot untuk mode demo. Tidak memakai model AI: jawaban disusun dari
// data kandang yang sama dengan dashboard (snapshot Guard), jadi angkanya selalu
// cocok dengan yang dilihat peternak.

import { getGuardSettings } from "@/lib/guard-settings";
import { buildSnapshots, type KandangSnapshot } from "@/lib/kandang-snapshot";
import { expectedWaterPerBirdLPerDay, formatRupiah } from "@/lib/broiler-reference";
import { ALERT_TIER_ORDER } from "@/lib/kandang-insights";
import { getRoomExtra } from "@/lib/broiler-local-store";
import { getDB } from "./db";
import { liveStatusList } from "./runtime";

const num = (v: number, d = 0) => v.toLocaleString("id-ID", { maximumFractionDigits: d, minimumFractionDigits: d });

function snapshotsNow() {
    const db = getDB();
    return buildSnapshots(db.rooms, db.leases.filter((l) => l.status === "active"), liveStatusList(), getGuardSettings());
}

function waterLine(s: KandangSnapshot) {
    const { insights } = s;
    if (!s.cycle || s.ageDays == null) return `**Kandang ${s.room.number}** sedang istirahat.`;
    if (insights.waterPerBirdPace == null) return `**Kandang ${s.room.number}**: data air hari ini belum cukup (butuh ±2 jam pembacaan).`;
    const expected = expectedWaterPerBirdLPerDay(s.ageDays);
    const pct = insights.waterDeviation?.pct ?? 0;
    const status = insights.waterDeviation?.tier === "kritis" ? "jauh di bawah pola ⚠️" : insights.waterDeviation?.tier === "waspada" ? (pct > 0 ? "di atas pola (cek kebocoran)" : "di bawah pola") : "normal";
    return `**Kandang ${s.room.number}** (hari ke-${s.ageDays}): ${num(insights.waterPerBirdPace, 3)} L/ekor/hari vs pola ${num(expected, 3)} L (${pct >= 0 ? "+" : ""}${num(pct)}%) — ${status}.`;
}

function powerLine(s: KandangSnapshot) {
    const actual = s.insights.actualPowerKw;
    if (!s.online) return `**Kandang ${s.room.number}**: perangkat offline.`;
    const expected = s.expectedPowerKw;
    const dev = s.insights.powerDeviation;
    return `**Kandang ${s.room.number}**: ${num(actual, 2)} kW${expected ? ` dari seharusnya ${num(expected, 2)} kW (${dev && dev.pct >= 0 ? "+" : ""}${num(dev?.pct ?? 0)}%)` : ""}.`;
}

function sortByUrgency(list: KandangSnapshot[]) {
    const worst = (s: KandangSnapshot) => Math.min(3, ...s.insights.alerts.map((a) => ALERT_TIER_ORDER[a.tier]));
    return [...list].sort((a, b) => worst(a) - worst(b));
}

export function copilotAnswer(rawQuestion: string): string {
    const focusNumber = rawQuestion.match(/Pertanyaan ini tentang Kandang (\S+?) \(/)?.[1];
    const question = (rawQuestion.match(/Pertanyaan:\s*([\s\S]*)$/)?.[1] ?? rawQuestion).trim();
    const q = question.toLowerCase();

    const all = snapshotsNow();
    const mentioned = all.find((s) => q.includes(`kandang ${s.room.number.toLowerCase()}`) || q.includes(s.room.number.toLowerCase()));
    const focus = mentioned ?? all.find((s) => s.room.number === focusNumber);
    const scope = focus ? [focus] : all.filter((s) => s.cycle);
    const rate = getDB().tariff.electricity_rate;

    if (scope.length === 0) {
        return "Belum ada kandang dengan siklus berjalan. Mulai siklus dari halaman kandang saat DOC masuk, nanti saya bisa menganalisis air, listrik, dan biayanya.";
    }

    // Hemat energi
    if (/hemat|efisien|tips|kurangi|boros/.test(q)) {
        const target = focus ?? scope[0];
        const equipment = getRoomExtra(target.room.id).equipment ?? [];
        const watt = (type: string) => equipment.filter((e) => e.type === type && e.active).reduce((s, e) => s + e.count * e.watt, 0);
        const heaterW = watt("pemanas");
        const fanW = watt("kipas");
        const totalW = (target.expectedPowerKw ?? target.insights.actualPowerKw) * 1000;
        const biggest = heaterW >= fanW ? { name: "bohlam brooder", w: heaterW } : { name: "kipas", w: fanW };
        return [
            `Di **Kandang ${target.room.number}**, beban terbesar adalah ${biggest.name} (${num(biggest.w)} W, ±${num(totalW > 0 ? (biggest.w / totalW) * 100 : 0)}% dari total ${num(totalW)} W). Langkah yang paling berdampak:`,
            heaterW > 0
                ? "- Bohlam brooder: pasang tudung/reflektor agar panas turun ke anak ayam, naikkan tinggi lampu atau matikan sebagian saat siang hari panas, dan lepas bertahap setelah hari ke-10–14."
                : "- Brooder sudah selesai — pastikan bohlam pijar benar-benar dicabut, jangan hanya dinaikkan.",
            fanW > 0
                ? "- Kipas: nyalakan saat siang panas (±10.00–16.00) atau saat ayam terlihat megap-megap; malam hari cukup ventilasi alami dari tirai."
                : "- Kipas belum perlu di umur ini — buka-tutup tirai sudah cukup untuk sirkulasi udara.",
            "- Lampu: pakai LED 5–10 W, matikan 1–4 jam di malam hari setelah minggu pertama (program terang-gelap).",
            `Dengan tarif ${formatRupiah(rate)}/kWh, menghemat 100 W selama 10 jam/hari ≈ ${formatRupiah(rate * 1 * 30)} per bulan.`,
        ].join("\n");
    }

    // Air minum
    if (/air|minum|nipple|bocor/.test(q)) {
        const lines = sortByUrgency(scope).map(waterLine);
        const low = scope.filter((s) => s.insights.waterDeviation?.direction === "turun" && s.insights.waterDeviation.tier !== "normal");
        return [
            focus ? "Kondisi air minum hari ini (laju dihitung sejak tengah malam):" : "Perbandingan air minum tiap kandang hari ini (laju sejak tengah malam):",
            ...lines.map((l) => `- ${l}`),
            low.length > 0
                ? `Untuk ${low.map((s) => `Kandang ${s.room.number}`).join(", ")}: cek tekanan regulator & sumbatan nipple di ujung jalur, pastikan suhu air tidak terlalu hangat, lalu amati ayam yang lesu. Air yang turun sering jadi tanda awal stres panas atau penyakit.`
                : "Semua masih dalam rentang normal pola hari umur.",
        ].join("\n");
    }

    // Panen
    if (/panen|harvest|umur|selesai/.test(q)) {
        const lines = scope
            .filter((s) => s.cycle && s.ageDays != null)
            .sort((a, b) => (a.harvestTargetDays - (a.ageDays ?? 0)) - (b.harvestTargetDays - (b.ageDays ?? 0)))
            .map((s) => {
                const left = s.harvestTargetDays - (s.ageDays ?? 0);
                return `- **Kandang ${s.room.number}**: hari ke-${s.ageDays} dari ${s.harvestTargetDays} → ${left > 0 ? `${left} hari lagi` : left === 0 ? "panen hari ini" : `lewat ${-left} hari`}${s.populationNow ? ` · ±${num(s.populationNow)} ekor` : ""}`;
            });
        return ["Urutan siklus yang paling dekat panen:", ...lines, "Siapkan jadwal tangkap & puasakan pakan 6–8 jam sebelum panen agar susut bobot dan karkas kotor berkurang."].join("\n");
    }

    // Listrik & biaya
    if (/listrik|biaya|energi|kwh|tagihan|daya/.test(q)) {
        const totalKw = scope.reduce((s, x) => s + (x.online ? x.insights.actualPowerKw : 0), 0);
        const todayKwh = scope.reduce((s, x) => s + (x.todayUsage.ready ? x.todayUsage.energyTodayKwh : 0), 0);
        const hours = Math.max(1, (Date.now() - new Date().setHours(0, 0, 0, 0)) / 3_600_000);
        const monthKwh = (todayKwh / hours) * 24 * 30;
        return [
            `Saat ini ${focus ? `Kandang ${focus.room.number}` : "semua kandang aktif"} memakai **${num(totalKw, 2)} kW**. Energi sejak tengah malam **${num(todayKwh, 1)} kWh** (≈ ${formatRupiah(todayKwh * rate)}).`,
            ...sortByUrgency(scope).map((s) => `- ${powerLine(s)}`),
            `Bila pola hari ini berlanjut, perkiraan 30 hari ±${num(monthKwh)} kWh ≈ **${formatRupiah(monthKwh * rate)}**.`,
        ].join("\n");
    }

    // Tindakan / kondisi umum
    const alerts = sortByUrgency(scope)
        .flatMap((s) => s.insights.alerts.map((a) => ({ ...a, room: s.room.number })))
        .sort((a, b) => ALERT_TIER_ORDER[a.tier] - ALERT_TIER_ORDER[b.tier]);
    const important = alerts.filter((a) => a.tier !== "info");

    if (/lakukan|tindakan|harus|prioritas|langkah/.test(q)) {
        if (alerts.length === 0) return `Tidak ada peringatan di ${focus ? `Kandang ${focus.room.number}` : "kandang aktif"}. Lanjutkan rutinitas: cek nipple & tempat pakan, catat deplesi harian, dan timbang sampel 1×/minggu.`;
        return [
            "Urutan yang saya sarankan:",
            ...alerts.slice(0, 5).map((a, i) => `- ${i + 1}. **Kandang ${a.room} — ${a.title}**: ${a.action}`),
        ].join("\n");
    }

    const lines = sortByUrgency(scope).map((s) => {
        const top = [...s.insights.alerts].sort((a, b) => ALERT_TIER_ORDER[a.tier] - ALERT_TIER_ORDER[b.tier])[0];
        const pop = s.populationNow ? `${num(s.populationNow)} ekor` : "populasi belum diisi";
        return `- **Kandang ${s.room.number}** (hari ke-${s.ageDays}, ${pop}): ${top ? `${top.tier} — ${top.title}` : "normal"}; daya ${num(s.insights.actualPowerKw, 2)} kW.`;
    });
    return [
        important.length > 0
            ? `Ada **${important.length} peringatan** yang perlu dicek${focus ? ` di Kandang ${focus.room.number}` : ""}:`
            : `${focus ? `Kandang ${focus.room.number}` : "Semua kandang aktif"} dalam kondisi baik:`,
        ...lines,
        important.length > 0 ? `Mulai dari: ${important[0].action}` : "Tetap pantau air minum siang hari saat suhu naik.",
    ].join("\n");
}
